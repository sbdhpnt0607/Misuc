#include <misuc/engine/audio/WASAPIBackend.h>

#if defined(_WIN32)

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <mmreg.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <avrt.h>
#include <propidl.h>
#include <propkey.h>

#include <algorithm>
#include <chrono>
#include <cstring>
#include <string>

namespace misuc::engine {

namespace {

// GUIDs spelled out so the backend compiles with any toolchain (MSVC and
// MinGW-w64 alike) without depending on each SDK's uuid import coverage.
const CLSID kMMDeviceEnumeratorClsid = {
    0xBCDE0395, 0xE52F, 0x467C, {0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E}};
const IID kIMMDeviceEnumeratorIid = {
    0xA95664D2, 0x9614, 0x4F35, {0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6}};
const IID kIAudioClientIid = {
    // {1CB9AD4C-DBFA-4C32-B178-C2F568A703B2}
    0x1CB9AD4C, 0xDBFA, 0x4C32, {0xB1, 0x78, 0xC2, 0xF5, 0x68, 0xA7, 0x03, 0xB2}};
const IID kIAudioRenderClientIid = {
    0xF294ACFC, 0x3146, 0x4483, {0xA7, 0xBF, 0xAD, 0xDC, 0xA7, 0xC2, 0x60, 0xE2}};
const IID kIAudioCaptureClientIid = {
    0xC8ADBD64, 0xE71E, 0x48A0, {0xA4, 0xDE, 0x18, 0x5C, 0x39, 0x5C, 0xD3, 0x17}};
const GUID kIeeeFloatSubFormat = {
    0x00000003, 0x0000, 0x0010, {0x80, 0x00, 0x00, 0xAA, 0x00, 0x38, 0x9B, 0x71}};
// PKEY_Device_FriendlyName / PKEY_Device_DeviceDesc (defined locally so every
// toolchain agrees; functiondiscoverykeys_devpkey.h is fine on MSVC but not
// consistently present in MinGW distributions).
const PROPERTYKEY kKeyDeviceFriendlyName = {
    {0xA45C254E, 0xDF1C, 0x4EFD, {0x80, 0x20, 0x67, 0xD1, 0x46, 0xA8, 0x50, 0xE0}},
    14};
const PROPERTYKEY kKeyDeviceDescription = {
    {0xA45C254E, 0xDF1C, 0x4EFD, {0x80, 0x20, 0x67, 0xD1, 0x46, 0xA8, 0x50, 0xE0}},
    2};

// Minimal RAII COM wrapper so this file works under both MSVC and MinGW-w64
// (where <wrl/client.h> is not reliably shipped).
template <typename T>
class ComPtr {
public:
  ComPtr() = default;
  ~ComPtr() { release(); }
  ComPtr(const ComPtr&) = delete;
  ComPtr& operator=(const ComPtr&) = delete;

  T** put() {
    release();
    return &ptr_;
  }
  T* get() const { return ptr_; }
  T* operator->() const { return ptr_; }
  explicit operator bool() const { return ptr_ != nullptr; }

  void release() {
    if (ptr_) {
      ptr_->Release();
      ptr_ = nullptr;
    }
  }

private:
  T* ptr_ = nullptr;
};

std::string utf8FromWide(const std::wstring& wide) {
  if (wide.empty())
    return {};
  const int need = ::WideCharToMultiByte(CP_UTF8, 0, wide.data(),
                                         static_cast<int>(wide.size()),
                                         nullptr, 0, nullptr, nullptr);
  std::string out(static_cast<size_t>(need), '\0');
  ::WideCharToMultiByte(CP_UTF8, 0, wide.data(), static_cast<int>(wide.size()),
                        out.data(), need, nullptr, nullptr);
  return out;
}

std::wstring wideFromUtf8(const std::string& utf8) {
  if (utf8.empty())
    return {};
  const int need = ::MultiByteToWideChar(CP_UTF8, 0, utf8.data(),
                                         static_cast<int>(utf8.size()),
                                         nullptr, 0);
  std::wstring out(static_cast<size_t>(need), L'\0');
  ::MultiByteToWideChar(CP_UTF8, 0, utf8.data(), static_cast<int>(utf8.size()),
                        out.data(), need);
  return out;
}

std::string propertyString(IPropertyStore* store, const PROPERTYKEY& key) {
  if (!store)
    return {};
  PROPVARIANT value;
  ::PropVariantInit(&value);
  std::string out;
  if (SUCCEEDED(store->GetValue(key, &value)) && value.vt == VT_LPWSTR &&
      value.pwszVal)
    out = utf8FromWide(std::wstring(value.pwszVal));
  ::PropVariantClear(&value);
  return out;
}

std::string endpointString(IMMDevice* device) {
  if (!device)
    return {};
  LPWSTR raw = nullptr;
  std::string id;
  if (SUCCEEDED(device->GetId(&raw)) && raw) {
    id = utf8FromWide(std::wstring(raw));
    ::CoTaskMemFree(raw);
  }
  return id;
}

// One shared initialization guard per thread; CoUninitialize only if we were
// the ones to initialize (RPC_E_CHANGED_MODE means someone else owns it).
class ComInit {
public:
  ComInit() {
    const HRESULT hr = ::CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    owns_ = SUCCEEDED(hr);
  }
  ~ComInit() {
    if (owns_)
      ::CoUninitialize();
  }

private:
  bool owns_ = false;
};

// Builds the requested stream format: plain IEEE-float WAVEFORMATEX for the
// common 1/2 channel layouts, WAVEFORMATEXTENSIBLE beyond that. Shared-mode
// sample-rate/channel mismatches against the device mix format are converted
// by WASAPI itself (AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM, Windows 10 1703+).
class AudioFormat {
public:
  AudioFormat(uint32_t rate, uint32_t channels) : channels_(channels) {
    base_.wFormatTag =
        channels > 2 ? WAVE_FORMAT_EXTENSIBLE : WAVE_FORMAT_IEEE_FLOAT;
    base_.nChannels = static_cast<WORD>(channels);
    base_.nSamplesPerSec = rate;
    base_.wBitsPerSample = 32;
    base_.nBlockAlign = static_cast<WORD>(channels * 4);
    base_.nAvgBytesPerSec = base_.nBlockAlign * rate;
    if (channels > 2) {
      ext_.Format = base_;
      ext_.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
      ext_.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
      ext_.Samples.wValidBitsPerSample = 32;
      // Generic one-bit-per-loudspeaker mask; consumers that care about true
      // multichannel routing pick ports through the mixer.
      DWORD mask = 0;
      for (DWORD bit = 0; bit < channels && bit < 18; ++bit)
        mask |= (1u << bit);
      ext_.dwChannelMask = mask;
      ext_.SubFormat = kIeeeFloatSubFormat;
    }
  }
  const WAVEFORMATEX* format() const {
    return channels_ > 2 ? &ext_.Format : &base_;
  }

private:
  WAVEFORMATEX base_{};
  WAVEFORMATEXTENSIBLE ext_{};
  uint32_t channels_ = 2;
};

} // namespace

// ---- public ----------------------------------------------------------------

WASAPIBackend::WASAPIBackend() {
  std::memset(outScratch_, 0, sizeof outScratch_);
}
WASAPIBackend::~WASAPIBackend() { stop(); }

std::string WASAPIBackend::backendName() const { return "WASAPI"; }

const AudioConfig& WASAPIBackend::config() const { return config_; }

std::vector<uint32_t> WASAPIBackend::supportedSampleRates() const {
  return {22050, 32000, 44100, 48000, 88200, 96000, 192000};
}
std::vector<uint32_t> WASAPIBackend::supportedBufferSizes() const {
  return {16, 32, 64, 128, 256, 512, 1024, 2048};
}

std::vector<AudioDeviceInfo> WASAPIBackend::enumerateDevices(bool input) {
  std::vector<AudioDeviceInfo> result;
  ComInit com;

  ComPtr<IMMDeviceEnumerator> enumerator;
  HRESULT hr = ::CoCreateInstance(kMMDeviceEnumeratorClsid, nullptr, CLSCTX_ALL,
                                  kIMMDeviceEnumeratorIid,
                                  reinterpret_cast<void**>(enumerator.put()));
  if (FAILED(hr) || !enumerator.get())
    return result;

  const EDataFlow flow = input ? eCapture : eRender;

  ComPtr<IMMDevice> device;
  // The default device first, then the remaining active endpoints.
  if (SUCCEEDED(
          enumerator.get()->GetDefaultAudioEndpoint(flow, eConsole,
                                                    device.put())) &&
      device.get()) {
    ComPtr<IPropertyStore> store;
    if (SUCCEEDED(device.get()->OpenPropertyStore(STGM_READ, store.put()))) {
      AudioDeviceInfo info;
      info.id = endpointString(device.get());
      info.name = propertyString(store.get(), kKeyDeviceFriendlyName);
      info.description = propertyString(store.get(), kKeyDeviceDescription);
      info.api = "wasapi";
      info.isInput = input;
      if (!info.id.empty() && !info.name.empty())
        result.push_back(info);
    }
  }

  ComPtr<IMMDeviceCollection> collection;
  if (SUCCEEDED(enumerator.get()->EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE,
                                                     collection.put())) &&
      collection.get()) {
    UINT count = 0;
    collection.get()->GetCount(&count);
    const std::string defaultId = result.empty() ? std::string()
                                                 : result.front().id;
    for (UINT i = 0; i < count; ++i) {
      ComPtr<IMMDevice> item;
      if (FAILED(collection.get()->Item(i, item.put())) || !item.get())
        continue;
      ComPtr<IPropertyStore> store;
      if (FAILED(item.get()->OpenPropertyStore(STGM_READ, store.put())))
        continue;
      AudioDeviceInfo info;
      info.id = endpointString(item.get());
      info.name = propertyString(store.get(), kKeyDeviceFriendlyName);
      info.description = propertyString(store.get(), kKeyDeviceDescription);
      info.api = "wasapi";
      info.isInput = input;
      if (info.id.empty() || info.name.empty() || info.id == defaultId)
        continue;
      result.push_back(info);
    }
  }
  return result;
}

bool WASAPIBackend::open(const AudioConfig& config, std::string& error) {
  if (running_.load()) {
    error = "The audio engine is already running.";
    return false;
  }
  config_ = config;
  channels_ = config.channels == 0 ? 2 : config.channels;
  inputChannels_ = config.inputChannels == 0 ? 2 : config.inputChannels;
  sampleRate_ = config.sampleRate == 0 ? 48000 : config.sampleRate;
  if (channels_ > kMaxScratchChannels) {
    error = "Unsupported output channel count: " + std::to_string(channels_);
    return false;
  }
  if (inputChannels_ > kMaxScratchChannels) {
    error = "Unsupported input channel count: " + std::to_string(inputChannels_);
    return false;
  }
  std::memset(outScratch_, 0, sizeof outScratch_);
  std::memset(inScratch_, 0, sizeof inScratch_);
  return true;
}

bool WASAPIBackend::start(AudioRenderer& renderer) {
  if (running_.load())
    return true;
  renderer_ = &renderer;
  stateReachedOut_.store(false);
  stateReachedIn_.store(false);
  outState_.store(0);
  inState_.store(0);
  streamWasError_ = false;
  {
    std::lock_guard<std::mutex> lk(streamMutex_);
    streamError_.clear();
  }
  negotiatedInputChannels_.store(0);
  negotiatedBuffer_.store(0);
  negotiatedChannels_.store(0);
  negotiatedRate_.store(0);

  // Manual-reset wake-up shared by both threads plus one auto-reset event
  // per stream. (The capture event is created below only when it is used.)
  exitEvent_ = ::CreateEventW(nullptr, TRUE, FALSE, nullptr);
  outBufferEvent_ = ::CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (!exitEvent_ || !outBufferEvent_) {
    setStreamError("Could not create the audio thread events.");
    if (exitEvent_) { ::CloseHandle(exitEvent_); exitEvent_ = nullptr; }
    if (outBufferEvent_) { ::CloseHandle(outBufferEvent_); outBufferEvent_ = nullptr; }
    renderer_ = nullptr;
    return false;
  }

  try {
    outThread_ = std::thread([this] { renderLoop(); });
  } catch (...) {
    setStreamError("Could not create the audio thread.");
    if (exitEvent_) { ::CloseHandle(exitEvent_); exitEvent_ = nullptr; }
    if (outBufferEvent_) { ::CloseHandle(outBufferEvent_); outBufferEvent_ = nullptr; }
    renderer_ = nullptr;
    return false;
  }

  const bool wantCapture = !config_.inputDeviceId.empty();
  if (wantCapture) {
    inBufferEvent_ = ::CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (!inBufferEvent_) {
      setStreamError("Could not create the audio thread events.");
      stop();
      return false;
    }
    try {
      inThread_ = std::thread([this] { captureLoop(); });
    } catch (...) {
      setStreamError("Could not create the input thread.");
      stop();
      return false;
    }
  }

  // Wait for the output thread to report Start() success (or failure) the
  // same way the PipeWire backend waits for the streaming state, with the
  // same 8 s connect timeout.
  {
    std::unique_lock<std::mutex> lk(streamMutex_);
    const bool ready = stateCv_.wait_for(
        lk, std::chrono::milliseconds(8000),
        [&] { return stateReachedOut_.load(); });
    if (!ready) {
      // stop() joins the render thread, which may need this mutex to notify.
      lk.unlock();
      stop();
      setStreamError("Timed out connecting the output device.");
      return false;
    }
    if (outState_.load() == -1) {
      const std::string err = streamError_; // copy while holding the lock
      lk.unlock();
      stop();
      setStreamError(err);
      return false;
    }
  }

  if (wantCapture) {
    std::unique_lock<std::mutex> lk(streamMutex_);
    const bool ready = stateCv_.wait_for(
        lk, std::chrono::milliseconds(8000),
        [&] { return stateReachedIn_.load(); });
    if (!ready) {
      lk.unlock();
      stop();
      setStreamError("Timed out connecting the input device.");
      return false;
    }
    if (inState_.load() == -1) {
      const std::string err = streamError_; // copy while holding the lock
      lk.unlock();
      stop();
      setStreamError(err);
      return false;
    }
    if (negotiatedInputChannels_.load() == 0)
      negotiatedInputChannels_.store(inputChannels_);
  }

  if (negotiatedRate_.load() == 0)
    negotiatedRate_.store(sampleRate_);
  if (negotiatedChannels_.load() == 0)
    negotiatedChannels_.store(channels_);

  running_.store(true);
  lastProcessTimeNs_.store(-1, std::memory_order_relaxed);
  lastPosition_.store(0, std::memory_order_relaxed);
  outDelayMs_.store(0.0, std::memory_order_relaxed);
  inDelayMs_.store(0.0, std::memory_order_relaxed);
  return true;
}

void WASAPIBackend::stop() noexcept {
  running_.store(false);
  if (exitEvent_)
    ::SetEvent(exitEvent_);
  if (outThread_.joinable())
    outThread_.join();
  if (inThread_.joinable())
    inThread_.join();
  if (exitEvent_) { ::CloseHandle(exitEvent_); exitEvent_ = nullptr; }
  if (outBufferEvent_) {
    ::CloseHandle(outBufferEvent_);
    outBufferEvent_ = nullptr;
  }
  if (inBufferEvent_) {
    ::CloseHandle(inBufferEvent_);
    inBufferEvent_ = nullptr;
  }
  renderer_ = nullptr;
  running_.store(false);
}

bool WASAPIBackend::isRunning() const { return running_.load(); }

BackendStatus WASAPIBackend::status() const {
  BackendStatus s;
  s.running = running_.load();
  s.framesProcessed = framesProcessed_.load();
  s.xruns = xruns_.load();
  s.negotiatedRate = negotiatedRate_.load();
  s.negotiatedChannels = negotiatedChannels_.load();
  s.negotiatedInputChannels = negotiatedInputChannels_.load();
  s.negotiatedBuffer = negotiatedBuffer_.load();
  if (running_.load()) {
    std::lock_guard<std::mutex> lk(streamMutex_);
    s.error = streamError_;
  }
  return s;
}

LatencyInfo WASAPIBackend::latency() const {
  LatencyInfo l;
  const uint32_t rate =
      negotiatedRate_.load() ? negotiatedRate_.load() : sampleRate_;
  const uint32_t buf = negotiatedBuffer_.load() ? negotiatedBuffer_.load()
                                                : config_.bufferSize;
  l.bufferMs = static_cast<double>(buf) * 1000.0 / rate;
  l.outputMs = l.bufferMs + outDelayMs_.load(std::memory_order_relaxed);
  l.inputMs = l.bufferMs + inDelayMs_.load(std::memory_order_relaxed);
  l.roundTripMs = l.outputMs + l.inputMs;
  return l;
}

void WASAPIBackend::setStreamError(const std::string& error) noexcept {
  std::lock_guard<std::mutex> lk(streamMutex_);
  streamError_ = error;
}

// ---- realtime threads ------------------------------------------------------

void WASAPIBackend::renderLoop() noexcept {
  ComInit com;
  DWORD taskIndex = 0;
  void* mmcss = ::AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);

  ComPtr<IMMDeviceEnumerator> enumerator;
  ComPtr<IMMDevice> device;
  ComPtr<IAudioClient> client;
  ComPtr<IAudioRenderClient> renderClient;
  WAVEFORMATEX* mix = nullptr;
  AudioFormat desired(sampleRate_, channels_);
  bool started = false;

  auto fail = [&](const char* message) {
    if (mix) {
      ::CoTaskMemFree(mix);
      mix = nullptr;
    }
    if (started)
      client.get()->Stop();
    if (mmcss)
      ::AvRevertMmThreadCharacteristics(mmcss);
    setStreamError(message);
    outState_.store(-1);
    stateReachedOut_.store(true);
    std::lock_guard<std::mutex> lk(streamMutex_);
    stateCv_.notify_all();
  };

  HRESULT hr = ::CoCreateInstance(kMMDeviceEnumeratorClsid, nullptr, CLSCTX_ALL,
                                  kIMMDeviceEnumeratorIid,
                                  reinterpret_cast<void**>(enumerator.put()));
  if (FAILED(hr) || !enumerator.get())
    return fail("Could not open the output device.");

  if (config_.deviceId.empty())
    hr = enumerator.get()->GetDefaultAudioEndpoint(eRender, eConsole,
                                                   device.put());
  else
    hr = enumerator.get()->GetDevice(wideFromUtf8(config_.deviceId).c_str(),
                                     device.put());
  if (FAILED(hr) || !device.get())
    return fail("Could not open the output device.");

  hr = device.get()->Activate(kIAudioClientIid, CLSCTX_ALL, nullptr,
                              reinterpret_cast<void**>(client.put()));
  if (FAILED(hr) || !client.get())
    return fail("Could not open the output device.");

  // Shared-mode stream at the requested rate/channels in IEEE float; WASAPI
  // converts from the device mix format (Windows 10 1703+). On older systems
  // fall back to the mix format itself.
  const REFERENCE_TIME duration =
      static_cast<REFERENCE_TIME>(static_cast<long long>(config_.bufferSize) *
                                  10000000ll /
                                  (sampleRate_ ? sampleRate_ : 48000));
  hr = client.get()->Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM |
          AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
      duration, 0, desired.format(), nullptr);
  if (SUCCEEDED(hr)) {
    negotiatedRate_.store(sampleRate_);
    negotiatedChannels_.store(channels_);
  } else {
    if (FAILED(client.get()->GetMixFormat(&mix)) || !mix)
      return fail("The output device rejected the stream format.");
    negotiatedRate_.store(mix->nSamplesPerSec);
    negotiatedChannels_.store(mix->nChannels);
    hr = client.get()->Initialize(AUDCLNT_SHAREMODE_SHARED,
                                  AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                                  0, 0, mix, nullptr);
  }
  if (FAILED(hr))
    return fail("The output device rejected the stream format.");

  UINT32 bufferFrames = 0;
  hr = client.get()->GetBufferSize(&bufferFrames);
  if (FAILED(hr))
    return fail("Could not size the output buffer.");
  if (bufferFrames == 0)
    return fail("The output device rejected the stream format.");

  hr = client.get()->GetService(kIAudioRenderClientIid,
                                reinterpret_cast<void**>(renderClient.put()));
  if (FAILED(hr) || !renderClient.get())
    return fail("Could not create the output renderer.");

  hr = client.get()->SetEventHandle(outBufferEvent_);
  if (FAILED(hr))
    return fail("Could not arm the output callback.");

  hr = client.get()->Start();
  if (FAILED(hr))
    return fail("Could not start the output device.");
  started = true;

  // Signal the waiting start() that the stream is live.
  outState_.store(1);
  stateReachedOut_.store(true);
  {
    std::lock_guard<std::mutex> lk(streamMutex_);
    stateCv_.notify_all();
  }

  LARGE_INTEGER qpcFreq{};
  ::QueryPerformanceFrequency(&qpcFreq);
  int64_t lastQpc = 0;

  const HANDLE waitSet[2] = {exitEvent_, outBufferEvent_};
  for (;;) {
    const DWORD wait = ::WaitForMultipleObjects(2, waitSet, FALSE, INFINITE);
    if (wait != WAIT_OBJECT_0 + 1)
      break; // exit signalled: time to tear down
    if (!renderer_)
      break;

    UINT32 padding = 0;
    if (FAILED(client.get()->GetCurrentPadding(&padding)))
      continue;
    if (padding > bufferFrames)
      padding = bufferFrames;
    const UINT32 framesAvail = bufferFrames - padding;
    if (framesAvail == 0)
      continue;
    const UINT32 frames = framesAvail > kMaxScratchFrames
                             ? static_cast<UINT32>(kMaxScratchFrames)
                             : framesAvail;

    // Xrun detection like the PipeWire backend: the wall-clock gap since the
    // last callback exceeded three times the duration of the rendered block.
    LARGE_INTEGER now{};
    ::QueryPerformanceCounter(&now);
    const int64_t current = now.QuadPart;
    if (lastQpc > 0) {
      const double gapUs = static_cast<double>(current - lastQpc) * 1e6 /
                           static_cast<double>(qpcFreq.QuadPart);
      const double durUs = static_cast<double>(frames) * 1e6 /
                           static_cast<double>(sampleRate_);
      if (gapUs > durUs * 3.0)
        xruns_.fetch_add(1, std::memory_order_relaxed);
    }
    lastQpc = current;
    lastProcessTimeNs_.store(current, std::memory_order_relaxed);

    BYTE* buffer = nullptr;
    if (FAILED(renderClient.get()->GetBuffer(frames, &buffer)) || !buffer) {
      // Graceful, no crash — mirrors the PipeWire backend's xrun behaviour.
      continue;
    }

    const uint64_t position = lastPosition_.load(std::memory_order_relaxed);
    const uint32_t inCh = inCh_.load(std::memory_order_relaxed);
    renderer_->process(inCh > 0 ? &inScratch_[0][0] : nullptr,
                       inCh > 0 ? inCh : 0,
                       reinterpret_cast<float*>(buffer), channels_, frames,
                       position, sampleRate_);
    if (FAILED(renderClient.get()->ReleaseBuffer(frames, 0)))
      break;

    lastPosition_.fetch_add(frames, std::memory_order_relaxed);
    framesProcessed_.fetch_add(frames, std::memory_order_relaxed);
    negotiatedBuffer_.store(frames, std::memory_order_relaxed);
    outDelayMs_.store(static_cast<double>(padding) * 1000.0 /
                          static_cast<double>(sampleRate_),
                      std::memory_order_relaxed);
  }

  if (started)
    client.get()->Stop();
  if (mmcss)
    ::AvRevertMmThreadCharacteristics(mmcss);
}

void WASAPIBackend::captureLoop() noexcept {
  ComInit com;
  DWORD taskIndex = 0;
  void* mmcss = ::AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);

  ComPtr<IMMDeviceEnumerator> enumerator;
  ComPtr<IMMDevice> device;
  ComPtr<IAudioClient> client;
  ComPtr<IAudioCaptureClient> captureClient;
  WAVEFORMATEX* mix = nullptr;
  AudioFormat desired(sampleRate_, inputChannels_);
  bool started = false;

  auto fail = [&](const char* message) {
    if (mix) {
      ::CoTaskMemFree(mix);
      mix = nullptr;
    }
    if (started)
      client.get()->Stop();
    if (mmcss)
      ::AvRevertMmThreadCharacteristics(mmcss);
    setStreamError(message);
    inState_.store(-1);
    stateReachedIn_.store(true);
    std::lock_guard<std::mutex> lk(streamMutex_);
    stateCv_.notify_all();
  };

  HRESULT hr = ::CoCreateInstance(kMMDeviceEnumeratorClsid, nullptr, CLSCTX_ALL,
                                  kIMMDeviceEnumeratorIid,
                                  reinterpret_cast<void**>(enumerator.put()));
  if (FAILED(hr) || !enumerator.get())
    return fail("Could not open the input device.");

  if (config_.inputDeviceId.empty())
    hr = enumerator.get()->GetDefaultAudioEndpoint(eCapture, eConsole,
                                                   device.put());
  else
    hr = enumerator.get()->GetDevice(
        wideFromUtf8(config_.inputDeviceId).c_str(), device.put());
  if (FAILED(hr) || !device.get())
    return fail("Could not open the input device.");

  hr = device.get()->Activate(kIAudioClientIid, CLSCTX_ALL, nullptr,
                              reinterpret_cast<void**>(client.put()));
  if (FAILED(hr) || !client.get())
    return fail("Could not open the input device.");

  const REFERENCE_TIME duration =
      static_cast<REFERENCE_TIME>(static_cast<long long>(config_.bufferSize) *
                                  10000000ll /
                                  (sampleRate_ ? sampleRate_ : 48000));
  hr = client.get()->Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM |
          AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
      duration, 0, desired.format(), nullptr);
  if (FAILED(hr)) {
    if (FAILED(client.get()->GetMixFormat(&mix)) || !mix)
      return fail("The input device rejected the stream format.");
    hr = client.get()->Initialize(AUDCLNT_SHAREMODE_SHARED,
                                  AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                                  0, 0, mix, nullptr);
  }
  if (FAILED(hr))
    return fail("The input device rejected the stream format.");

  hr = client.get()->GetService(kIAudioCaptureClientIid,
                                reinterpret_cast<void**>(captureClient.put()));
  if (FAILED(hr) || !captureClient.get())
    return fail("Could not create the input capture.");

  hr = client.get()->SetEventHandle(inBufferEvent_);
  if (FAILED(hr))
    return fail("Could not arm the input callback.");

  hr = client.get()->Start();
  if (FAILED(hr))
    return fail("Could not start the input device.");
  started = true;

  negotiatedInputChannels_.store(inputChannels_);
  inCh_.store(inputChannels_, std::memory_order_relaxed);

  inState_.store(1);
  stateReachedIn_.store(true);
  {
    std::lock_guard<std::mutex> lk(streamMutex_);
    stateCv_.notify_all();
  }

  const HANDLE waitSet[2] = {exitEvent_, inBufferEvent_};
  for (;;) {
    const DWORD wait = ::WaitForMultipleObjects(2, waitSet, FALSE, INFINITE);
    if (wait != WAIT_OBJECT_0 + 1)
      break;

    // Drain every packet queued by the capture engine and keep only the most
    // recent one visible to the render thread (same "latest snapshot"
    // contract as PipeWire, used for monitoring and metering).
    for (;;) {
      UINT32 packet = 0;
      if (FAILED(captureClient.get()->GetNextPacketSize(&packet)))
        break;
      if (packet == 0)
        break;
      BYTE* data = nullptr;
      UINT32 frames = 0;
      DWORD flags = 0;
      if (FAILED(captureClient.get()->GetBuffer(&data, &frames, &flags,
                                                nullptr, nullptr)))
        break;
      const uint32_t framesCopy =
          frames > kMaxScratchFrames ? static_cast<uint32_t>(kMaxScratchFrames)
                                     : frames;
      const uint32_t ch = inCh_.load(std::memory_order_relaxed);
      if ((flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0 || !data) {
        for (uint32_t c = 0; c < ch; ++c)
          std::memset(inScratch_[c], 0, framesCopy * sizeof(float));
      } else {
        const float* src = reinterpret_cast<const float*>(data);
        for (uint32_t c = 0; c < ch; ++c) {
          for (uint32_t i = 0; i < framesCopy; ++i)
            inScratch_[c][i] = src[i * ch + c];
        }
      }
      if (frames > 0)
        inDelayMs_.store(static_cast<double>(framesCopy) * 1000.0 /
                             static_cast<double>(sampleRate_),
                         std::memory_order_relaxed);
      captureClient.get()->ReleaseBuffer(frames);
    }
  }

  if (started)
    client.get()->Stop();
  if (mmcss)
    ::AvRevertMmThreadCharacteristics(mmcss);
}

} // namespace misuc::engine

#else // !_WIN32

// Deliberately empty on non-Windows platforms: the object is simply not part
// of the build there (the engine wires the platform backend in CMake).
namespace misuc::engine {
namespace {
[[maybe_unused]] constexpr int kWasapiWindowsOnly = 0;
}
}

#endif // _WIN32
