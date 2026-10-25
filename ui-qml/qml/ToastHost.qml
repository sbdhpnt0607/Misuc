import QtQuick
import QtQuick.Layouts
import "theme"
import "components"

/* ===========================================================================
   ToastHost — transient notifications anchored bottom-centre, mirroring the
   web #toast-host. show(message, kind) queues a pill that auto-dismisses.
   =========================================================================== */
Item {
    id: root
    anchors.fill: parent
    z: 1000

    function show(message, kind) {
        toastModel.append({ message: message, kind: kind || "" })
        // auto-remove after 2.6 s
        removeTimer.lastIndex = toastModel.count - 1
        removeTimer.restart()
    }

    ListModel { id: toastModel }
    Timer {
        id: removeTimer
        property int lastIndex: -1
        interval: 2600
        onTriggered: { if (lastIndex >= 0 && lastIndex < toastModel.count) toastModel.remove(lastIndex) }
    }

    Column {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 56
        spacing: 8

        Repeater {
            model: toastModel
            delegate: NeuSurface {
                required property var model
                surfRadius: Theme.radiusPill
                distance: Theme.d3; blur: Theme.blur3
                implicitHeight: 40
                implicitWidth: toastRow.implicitWidth + 36

                Row {
                    id: toastRow
                    anchors.centerIn: parent
                    spacing: 10
                    Rectangle {
                        anchors.verticalCenter: parent.verticalCenter
                        width: 8; height: 8; radius: 4
                        color: model.kind === "ok" ? Theme.ok : (model.kind === "warn" ? Theme.warn : Theme.accent)
                    }
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: model.message
                        color: Theme.textStrong
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                    }
                }

                // fade in
                opacity: 0
                Component.onCompleted: fade.running = true
                NumberAnimation { id: fade; target: parent; property: "opacity"; to: 1; duration: Theme.tMed }
            }
        }
    }
}
