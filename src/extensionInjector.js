"use strict";

function addScript(src, onload) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = chrome.extension.getURL(src);
    (document.body || document.head || document.documentElement).appendChild(script);

    script.onload = onload;
}

// Ran when extension loads
// Sends the urls of the extension pages in an object to the extension script
function onExtensionLoad() {
    var dialog = chrome.runtime.getURL("html/dialog.html");
    var upload = chrome.runtime.getURL("html/upload.html");
    var permissions = chrome.runtime.getURL("html/permissions.html");
    var mdlScript = chrome.runtime.getURL("dist/mdl/material.min.js");
    var selectScript = chrome.runtime.getURL("dist/mdl-select/getmdl-select.min.js");
    var encrypt = chrome.runtime.getURL("html/encrypt.html");
    var coordinate = chrome.runtime.getURL("html/coordinate.html");
    var coordinateSettings = chrome.runtime.getURL("html/coordinate_settings_2.html");
    var urls = { dialog, upload, permissions, mdlScript, encrypt, coordinate, coordinateSettings, selectScript };

    var event = document.createEvent("CustomEvent");
    event.initCustomEvent("securesendUiSrcTransfer", true, true, urls);
    document.dispatchEvent(event);
}

addScript("dist/gmailJsLoader.js");
addScript("dist/extension.js", onExtensionLoad);
