// ===========================================================================
// Misuc Neu — Qt Quick entry point (standalone design/preview build)
//
// This boots the neumorphic QML UI on its own so the design can be run and
// iterated without the audio engine. In the shipping app this same QML tree is
// loaded by the existing Qt Widgets host (see ui-qml/README.md — "Wiring to
// the engine"), where SongModel is replaced by a C++ bridge over Session /
// Transport / Mixer. Nothing here touches audio; it only loads QML.
// ===========================================================================

#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QIcon>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QGuiApplication::setApplicationName("Misuc Neu");
    QGuiApplication::setOrganizationName("Misuc");
    QGuiApplication::setApplicationVersion("0.2.0");

    // Use the Basic style so our neumorphic components are the only chrome.
    QQuickStyle::setStyle("Basic");

    QQmlApplicationEngine engine;
    // Import paths for the singleton modules (Theme, Components, Misuc).
    engine.addImportPath("qrc:/qml");

    const QUrl url(QStringLiteral("qrc:/qml/Main.qml"));
    QObject::connect(
        &engine, &QQmlApplicationEngine::objectCreationFailed, &app,
        []() { QCoreApplication::exit(-1); }, Qt::QueuedConnection);
    engine.load(url);

    if (engine.rootObjects().isEmpty())
        return -1;

    return app.exec();
}
