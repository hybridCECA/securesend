"use strict";

function addScript(src, onload) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = chrome.extension.getURL(src);
    (document.body || document.head || document.documentElement).appendChild(script);

    script.onload = onload;
}

function onExtensionLoad() {
    var url = chrome.runtime.getURL("html/uploadDialog.html");

    var event = document.createEvent("CustomEvent");
    event.initCustomEvent("securesendUiSrcTransfer", true, true, url);
    document.dispatchEvent(event);
}

addScript("dist/gmailJsLoader.js");
addScript("dist/extension.js", onExtensionLoad);
