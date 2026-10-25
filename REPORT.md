# Misuc 0.3.1 Windows crash — diagnosis and fix

## Summary

- **Symptom:** `misuc_app.exe` 0.3.1 starts, shows its splash/window, then exits with
  `0xC0000409` (`STATUS_STACK_BUFFER_OVERRUN`, actually a fail-fast abort from the CRT).
- **Verdict:** this is a **code bug**, not SmartScreen, antivirus, permissions, or an
  audio-driver problem. The same WASAPI calls succeed from a separate process on the
  same machine when the correct interface ID is used.
- **Trigger:** `WASAPIBackend::renderLoop()` calls
  `IMMDevice::Activate(IID_IAudioClient, ...)` with a **transposed IID**: the shipped
  code uses `1CB9AD4C-DBFA-4C32-B178-C2F568A7024C`; the Windows SDK value is
  `1CB9AD4C-DBFA-4C32-B178-C2F568A703B2`. `Activate` returns `E_NOINTERFACE`
  (`0x80004002`), so the output stream can never open.
- **Crash:** `WASAPIBackend::start()` handles that failure while still holding
  `streamMutex_`: it calls `stop()` and then `setStreamError()`, which locks the same
  non-recursive mutex. The resulting `std::system_error` is thrown inside a
  `noexcept` function, so the runtime calls `std::terminate()` → `abort()`.
- **Fix:** correct the IID and release `streamMutex_` before calling `stop()` /
  `setStreamError()` in both failure branches. A separate, test-only follow-up raises
  the release smoke wait from 6 s to 15 s so a delayed startup failure cannot pass
  unnoticed (see “CI smoke-test gap” below).

## Reported symptom (Step 0)

The installer wizard completed normally. Start Menu and Desktop shortcuts were
reported present. Launching Misuc showed a window/splash and then the process
disappeared; there was no usable error dialog and the window content stayed blank.

On this machine the reported behavior reproduced deterministically after a clean
silent install (see E1/E2): the process exits after **5.9–6.3 s** with
`0xC0000409`.

## Root cause

### 1. The `IAudioClient` IID is wrong

`engine/src/audio/WASAPIBackend.cpp` defines the interface IDs by hand so the file
builds with both MSVC and MinGW-w64. The `IAudioClient` entry was:

```cpp
const IID kIAudioClientIid = {
    0x1CB9AD4C, 0xDBFA, 0x4C32, {0xB1, 0x78, 0xC2, 0xF5, 0x68, 0xA7, 0x02, 0x4C}};
```

`Audioclient.h` in the Windows SDK declares:

```c
MIDL_INTERFACE("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2")
IAudioClient : public IUnknown
```

The last two bytes were transcribed as `02 4C` instead of `03 B2`, giving
`...A7024C`. `IMMDevice::Activate` therefore returns `E_NOINTERFACE`
(`0x80004002`). The enumerator CLSID/IID, `IAudioRenderClient`,
`IAudioCaptureClient`, and the float subformat GUID are all correct; only
`IAudioClient` was wrong.

Because the render loop fails at `Activate`, `renderLoop()` calls its `fail()` lambda
with `"Could not open the output device."`, which is the string found in the crash
dump. The stream never opens on any Windows machine; the device and audio service are
healthy.

### 2. The failure path re-locks `streamMutex_`

In `WASAPIBackend::start()`, the output wait block is:

```cpp
{
  std::unique_lock<std::mutex> lk(streamMutex_);
  const bool ready = stateCv_.wait_for(...);
  if (!ready) {
    stop();
    setStreamError("Timed out connecting the output device.");
    return false;
  }
  if (outState_.load() == -1) {
    const std::string err = streamError_;
    stop();
    setStreamError(err);
    return false;
  }
}
```

`setStreamError()` is:

```cpp
void WASAPIBackend::setStreamError(const std::string& error) noexcept {
  std::lock_guard<std::mutex> lk(streamMutex_);
  streamError_ = error;
}
```

Both failure branches call it while `lk` still owns `streamMutex_`. Locking a
non-recursive `std::mutex` twice from the same thread makes `std::mutex::lock()`
throw `std::system_error`; because `setStreamError` is `noexcept`, the runtime calls
`std::terminate()` and then `abort()`. That is the `0xC0000409` observed in the event
log and the `ucrtbase!abort` stack in the dump.

There is a second, latent problem in the same branches: `stop()` joins the audio
thread while `start()` holds `streamMutex_`, but the render/capture `fail()` path
takes that mutex to call `notify_all()`. Depending on timing this can deadlock even
before the re-lock. Releasing the mutex before `stop()` fixes both.

The input branch (`wantCapture`) has the identical pattern and is fixed the same way.

## Fix

Product code (`engine/src/audio/WASAPIBackend.cpp`):

1. Correct `kIAudioClientIid` to
   `1CB9AD4C-DBFA-4C32-B178-C2F568A703B2` and record the canonical string next to it.
2. In `start()`, copy the error under the lock and `lk.unlock()` before `stop()` /
   `setStreamError()` in the output and input failure branches.

CI smoke-test gap (`.github/workflows/release.yml`, separate follow-up):

3. The Windows installer smoke test sleeps **6 s** and then checks whether the app has
   exited. The v0.3.1 abort happens at **5.9–6.3 s** on this machine, so the check
   raced the crash and could pass while the app was about to abort. The wait should be
   **15 s**, with a comment explaining why. This is test-only hardening; it is kept
   out of this PR to keep the product diff minimal and does not affect the build or
   the installer verification below.

No other behavior changes. A working stream still follows the same path; only the
failure path and the interface ID change.

## Verification performed locally

- The released 0.3.1 binary with **only the two IID bytes patched**
  (`...A7024C` → `...A703B2`) starts normally, stays alive, and its Audio page shows
  **“Engine running on WASAPI”**, `Speaker (Realtek(R) Audio)`,
  `48000 Hz / 2 out / 0 in / 480 frames`, `0 xruns`. This isolates the IID as the
  functional cause.
- The crash stack and disassembly prove the abort is the recursive
  `setStreamError()` lock, not a stack-buffer overrun or an AV intervention.
- The fixed source itself is built by CI (no MSVC/Qt/vcpkg toolchain is installed on
  this machine); the CI-built installer is exercised separately below.

## CI and installer verification

- Branch build (`windows.yml`): `<pending>`
- Throwaway tag `v0.3.1-dbg.1` (`release.yml`): `<pending>`
- Installer downloaded from the tag run: `<pending>`
- Silent install + 15 s launch check of the fixed build: `<pending>`
- Negative test: fixed build with the IID re-broken should stay alive and report an
  audio error instead of aborting: `<pending>`
- Pull request: `<pending>`

## Follow-ups (not required for this fix)

- `WASAPIBackend::status()` only returns `streamError_` when `running_` is true. After
  a failed `start()` the UI therefore shows `Start failed: ` with no detail. This is
  pre-existing (the PipeWire backend has the same gating) and is not needed to fix
  the crash, but it makes graceful failures hard to diagnose.
- The live `wasapi_stream_lifecycle` test exercises this path and would catch the IID
  regression on a machine with an audio endpoint, but headless CI runners skip it.

## Evidence

### E1 — installer and clean silent install

```powershell
PS> Get-Item 'C:\Users\subod\Downloads\misuc-0.3.1-1-win64.exe' |
      Select-Object FullName,Length,LastWriteTime
FullName      : C:\Users\subod\Downloads\misuc-0.3.1-1-win64.exe
Length        : 22218898
LastWriteTime : 10/24/2026 03:55:10 PM

PS> Get-FileHash 'C:\Users\subod\Downloads\misuc-0.3.1-1-win64.exe' -Algorithm SHA256
Hash
----
E88BD0A21E1574A29E90F60AE4467C278759323C0BD4B2538EE853AEC928A3DE

PS> (Get-AuthenticodeSignature 'C:\Users\subod\Downloads\misuc-0.3.1-1-win64.exe').Status
NotSigned

PS> $inst = Start-Process -FilePath 'C:\Users\subod\Downloads\misuc-0.3.1-1-win64.exe' `
        -ArgumentList '/S','/D=C:\misuc_repro' -Wait -PassThru
PS> "installer exit=$($inst.ExitCode)"
installer exit=0
```

Payload contains `misuc_app.exe`, Qt6 Core/Gui/Widgets, `platforms\qwindows.dll`,
`sndfile.dll`, `z.dll`, and the MSVC runtime DLLs.

### E2 — clean reproduction and crash signature

```powershell
PS> 1..2 | ForEach-Object {
      $sw=[Diagnostics.Stopwatch]::StartNew()
      $app=Start-Process 'C:\misuc_repro\misuc_app.exe' -WorkingDirectory 'C:\misuc_repro' -PassThru
      while (-not $app.HasExited -and $sw.Elapsed.TotalSeconds -lt 30) {
        Start-Sleep -Milliseconds 100; $app.Refresh()
      }
      $sw.Stop()
      "trial $_`: exited after {0:N1}s, code=0x{1:X8}" -f $sw.Elapsed.TotalSeconds,$app.ExitCode
    }
trial 1: exited after 6.3s, code=0xC0000409
trial 2: exited after 5.9s, code=0xC0000409
```

```powershell
PS> Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1000} -MaxEvents 20 |
      Where-Object { $_.Message -match 'misuc_app' } | Select-Object -First 1 |
      ForEach-Object { $_.TimeCreated; $_.Message }
2026-10-25 16:04:04
Faulting application name: misuc_app.exe, version: 0.3.1.0, time stamp: 0x6adc409d
Faulting module name: ucrtbase.dll, version: 10.0.26100.9711, time stamp: 0x3f426c5b
Exception code: 0xc0000409
Fault offset: 0x00000000000a527e
Faulting application path: C:\misuc_manual\misuc_app.exe
Faulting module path: C:\WINDOWS\System32\ucrtbase.dll
```

### E3 — dump analysis: abort from a C++ exception, not a buffer overrun

```text
0:000> !analyze -v
...
EXCEPTION_CODE: (NTSTATUS) 0xc0000409 - The system detected an overrun ...
EXCEPTION_CODE_STR:  c0000409
FAIL_FAST_FATAL_APP_EXIT_c0000409_ucrtbase.dll!abort
STACK_TEXT:
ucrtbase!abort+0x4e
ucrtbase!terminate+0x1e
msvcp140!std::_Throw_Cpp_error+0x46
misuc_app+0xe4a1d
misuc_app+0xe4f62
misuc_app+0xe0518
misuc_app+0x58bd6
...
SYMBOL_NAME:  ucrtbase!abort+4e
MODULE_NAME: ucrtbase
IMAGE_NAME:  ucrtbase.dll
```

The `0xc0000409` text is the generic fail-fast code; the stack shows the real path:
`_Throw_Cpp_error` → `terminate` → `abort`.

### E4 — runtime breakpoints: which WASAPI call fails

Debugger script used:

```text
bp misuc_app+0xE3EEB ".echo ===COCREATE; r eax; gc"
bp misuc_app+0xE3FDF ".echo ===ENDPOINTHR; r ebx; gc"
bp misuc_app+0xE4031 ".echo ===ACTIVATEHR; r eax; gc"
bp misuc_app+0xE1A90 ".echo ===FAILLAMBDA; da @rdx; ? poi(@rsp); gc"
g
q
```

Result:

```text
===COCREATE
eax=0
===ENDPOINTHR
ebx=0
===ACTIVATEHR
eax=80004002
===FAILLAMBDA
00007ff6`ec7cc468  "Could not open the output device"
00007ff6`ec7cc488  "."
Evaluate expression: 140698503432180 = 00007ff6`ec5147f4
ucrtbase!abort+0x4e:
00007ffa`4886527e cd29            int     29h
```

- `CoCreateInstance(MMDeviceEnumerator)` = `S_OK`.
- `GetDefaultAudioEndpoint(eRender, eConsole)` = `S_OK`.
- `Activate(IID_IAudioClient)` = **`0x80004002`** (`E_NOINTERFACE`).
- The fail-lambda return address `0x...E47F4` identifies the first of the three
  `Could not open the output device.` branches: the `Activate` call is at
  `0xE402E`, and its failure jumps to the fail site at `0xE47E4`.
- The app then aborts in `ucrtbase!abort`.

### E5 — the IID in the shipped binary vs. the SDK

```python
PS> python find_xrefs2.py
text va 0x140001000 len 0x11A800
0x14039C468 b'Could not open the output device.'
...
=== b'Could not open the output device.': 3 hits
  0x1400E47E4 RVA 0xE47E4 target 0x14039C468
  0x1400E4857 RVA 0xE4857 target 0x14039C468
  0x1400E48C3 RVA 0xE48C3 target 0x14039C468
```

```python
PS> python -c "...search .rdata for the Activate IID..."
pattern at RVA 0x39c220
VA 0x14039c220
4cadb91cfadb324cb178c2f568a7024c
```

The bytes decode to `1CB9AD4C-DBFA-4C32-B178-C2F568A7024C`.

```text
PS> Select-String -Path "C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um\Audioclient.h" `
      -Pattern "1cb9ad4c|IAudioClient :"
    MIDL_INTERFACE("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2")
    IAudioClient : public IUnknown
```

### E6 — controlled A/B test from a separate process

The test binds `IMMDevice::Activate` directly and requests each IID; `[PreserveSig]`
returns the raw HRESULT instead of letting the CLR throw.

```powershell
PS> & $env:TEMP\wasapi_iid_raw.exe
CoInitializeEx(MTA): hr=0x00000001 (no message)
CoCreateInstance: hr=0x00000000 S_OK
GetDefaultAudioEndpoint(render,console): hr=0x00000000 S_OK

-- IID exactly as hardcoded in Misuc v0.3.1 --
Activate(1CB9AD4C-DBFA-4C32-B178-C2F568A7024C) -> hr=0x80004002 Specified cast is not valid.

-- IID from Windows SDK audioclient.h --
Activate(1CB9AD4C-DBFA-4C32-B178-C2F568A703B2) -> hr=0x00000000 S_OK
    GetMixFormat -> hr=0x00000000 S_OK
    mix format: tag=65534 channels=2 rate=48000 bits=32

RESULT: wrongIID=0x80004002 sdkIID=0x00000000
```

This rules out the device, the audio service, and COM initialization: the identical
machine and process return `S_OK` with the SDK IID.

### E7 — two-byte binary proof

A copy of the 0.3.1 install (`C:\misuc_patched`) had only the IID's last two bytes
changed in `misuc_app.exe`:

```text
before: 4cadb91cfadb324cb178c2f568a7024c
after : 4cadb91cfadb324cb178c2f568a703b2
sha256 before: cb489a7714b7da976e52445a5125589fde68fc866fea7745174bf22eea1660ea
sha256 after : 4a3f945754486504f742adf0d069a44e979c5432b990afa04dff889688f8d059
```

Launch result:

```text
t=5s HasExited=False
t=10s HasExited=False
t=15s HasExited=False
still alive; stopping
```

The Audio tab then showed:

```text
Output: Speaker (Realtek(R) Audio)
Engine running on WASAPI.
Buffer 10.0 ms | Output 22.0 ms | Input 10.0 ms | Round-trip 32.0 ms | 0 xruns
48000 Hz / 2 out / 0 in / 480 frames
```

No code other than the IID bytes was changed for this check.

### E8 — source diff

```diff
 const IID kIAudioClientIid = {
-    0x1CB9AD4C, 0xDBFA, 0x4C32, {0xB1, 0x78, 0xC2, 0xF5, 0x68, 0xA7, 0x02, 0x4C}};
+    // {1CB9AD4C-DBFA-4C32-B178-C2F568A703B2}
+    0x1CB9AD4C, 0xDBFA, 0x4C32, {0xB1, 0x78, 0xC2, 0xF5, 0x68, 0xA7, 0x03, 0xB2}};

     if (!ready) {
+      // stop() joins the render thread, which may need this mutex to notify.
+      lk.unlock();
       stop();
       setStreamError("Timed out connecting the output device.");
       return false;
     }
     if (outState_.load() == -1) {
-      const std::string err = streamError_; // we already hold the lock
+      const std::string err = streamError_; // copy while holding the lock
+      lk.unlock();
       stop();
       setStreamError(err);
       return false;
     }
```

The input branch has the same two `lk.unlock()` additions.

### E9 — machine/environment

```text
OS registry: ProductName=Windows 10 Home (legacy key), DisplayVersion=26H2,
             CurrentBuild=26300, UBR=9711  — i.e. Windows 11 26H2 build 26300.9711.

Audio services: Audiosrv Running/Automatic, AudioEndpointBuilder Running/Automatic.
Sound devices: Realtek High Definition Audio (OK),
               Intel Smart Sound Technology for Bluetooth Audio (OK),
               Intel Smart Sound Technology for Digital Microphones (OK).
```

The machine has working audio; the same default endpoint opened successfully in E6.
No antivirus exclusion or SmartScreen bypass was used for any of the tests.

### E10 — source commit under test

```text
windows-port @ a0c3d09b80ac9df6589e3ba336fff2073f0978be
docs: v0.3.1 release record - installer root cause, smoke verification, NOT-CLAIMED bounds
```
