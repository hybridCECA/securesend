(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

const securesendNs = {};

document.addEventListener("securesendUiSrcTransfer", function(event)
{
    securesendNs.urls = event.detail;
});

// loader-code: wait until gmailjs has finished loading, before triggering actual extensiode-code.
const loaderId = setInterval(() => {
    if (!window._gmailjs) {
        return;
    }

    clearInterval(loaderId);
    startExtension(window._gmailjs);
}, 100);

function handleFileSelected() {
    fetch(securesendNs.urls.permissions)
        .then(response => response.text())
        .then(data => {
            document.getElementById("securesend_dialog_body").innerHTML = data;
        }).catch(error => {
            console.log(error)
        });
}

function handleClose() {
    document.getElementById("securesend_dialog").className += " securesend_dialog_closed";
    setTimeout(() => {
        document.getElementById("securesend_ui_container").remove();
    }, 100);
}

function handleOpen() {
    const uiContainer = document.createElement("div");
    uiContainer.className = "securesend_ui_container";
    uiContainer.id = "securesend_ui_container";

    const backdrop = document.createElement("div");
    backdrop.className = "securesend_backdrop";
    uiContainer.append(backdrop)

    const dialog = document.createElement("div");
    dialog.className = "securesend_dialog";
    dialog.id = "securesend_dialog";

    const dialogContainer = document.createElement("div");
    dialogContainer.className = "securesend_dialog_container";
    dialogContainer.append(dialog)
    uiContainer.append(dialogContainer);

    fetch(securesendNs.urls.dialog)
    .then(response => response.text())
    .then(data => {
        dialog.innerHTML = data;
        document.getElementById("securesend_close").addEventListener("click", handleClose);


        fetch(securesendNs.urls.upload)
            .then(response => response.text())
            .then(data => {
                document.getElementById("securesend_dialog_body").innerHTML = data;
                document.getElementById("securesend_upload_input").addEventListener("change", handleFileSelected);
            }).catch(error => {
                console.log(error);
            });
    }).catch(error => {
        console.log(error);
    });

    document.body.append(uiContainer);
}

// actual extension-code
function startExtension(gmail) {
    console.log("Securesend loading...");
    window.gmail = gmail;

    gmail.observe.on("load", () => {
        console.log("Securesend successfully loaded.");

        gmail.observe.on("compose", function (compose, type) {
            const iconButton = document.createElement("div");
            iconButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M17 9.761v-4.761c0-2.761-2.238-5-5-5-2.763 0-5 2.239-5 5v4.761c-1.827 1.466-3 3.714-3 6.239 0 4.418 3.582 8 8 8s8-3.582 8-8c0-2.525-1.173-4.773-3-6.239zm-8-4.761c0-1.654 1.346-3 3-3s3 1.346 3 3v3.587c-.927-.376-1.938-.587-3-.587s-2.073.211-3 .587v-3.587zm3 17c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6zm2-6c0 1.104-.896 2-2 2s-2-.896-2-2 .896-2 2-2 2 .896 2 2z"/></svg>';
            iconButton.className = "securesend_button";

            const button = gmail.tools.add_compose_button(compose, iconButton, handleOpen, "");
            button.attr("class", "securesend_button_container");
            button.attr("style", "margin-left: 12px;");
        });

    });
}

},{}]},{},[1]);