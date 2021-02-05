"use strict";

(function () {
    // Imports
    const password = require('secure-random-password');
    const $ = require("jquery");
    const archiver = require('archiver');
    archiver.registerFormat('zip-encrypted', require("archiver-zip-encrypted"));
    const fs = require('browserify-fs');

    // Bundle to send to iframe
    let bundle = {};

    // Object containing urls
    let urls = {};

    // Compose window object
    let currentCompose;

    // Encrypting iframe
    let encryptIFrame;

    // Email address
    let email;

    // Index of current file
    let currentFileNum = -1;

    // Receive urls from extensionInjector
    document.addEventListener("securesendUiSrcTransfer", function (event) {
        urls = event.detail;
    });

    // Function used to run scripts from a url
    function runScript(url) {
        $.getScript(url, function (data, textStatus, jqxhr) {
            console.log(data); // Data returned
            console.log(textStatus); // Success
            console.log(jqxhr.status); // 200
            console.log("Script ran");
        });
    }

    // Ran when the encryption page loads
    // Sends the bundle for encryption
    function handleMessageReceived(event) {
        const { data } = event;
        if (data === "securesend_loaded") {
            console.log("securesend loaded")
            encryptIFrame.contentWindow.postMessage(bundle, "*");
        } else if (Object.prototype.toString.call(data) === "[object Object]" &&
            data.name === "securesend_done"
        ) {
            console.log(data.id);
            handleClose();
            currentCompose.close();

            const url = window.location.href.match(/(?<url>^.*#.*)(\?|\/|$)/).groups.url
            window.location.href = url + "/" + data.id;
        }
    }

    function fileToString(file) {
        return new Promise((accept, reject) => {
            const reader = new FileReader();
            reader.onloadend = function () {
                accept(reader.result);
            }
            reader.readAsText(file);
        });
    }

    function readFile(name) {
        return new Promise((accept, reject) => {
            fs.readFile(name, function (err, content) {
                const blob = new Blob([content], { type: "octet/stream" });
                accept(blob);
            });
        });
    }

    function containsNonPdf(fileList) {
        for (const file of fileList) {
            if (!file.name.endsWith(".pdf")) {
                return true;
            }
        }

        return false;
    }

    // Event handler for when "done" is clicked
    function handleDone() {

        // Create iframe with the encrypt url
        const iframe = document.createElement("iframe");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.setAttribute("src", urls.encrypt)
        encryptIFrame = iframe;

        // Add the iframe to the dialog
        const body = document.getElementById("securesend_dialog_body");
        body.innerHTML = '';
        body.appendChild(iframe);

        window.addEventListener("message", handleMessageReceived);
    }

    // Event handler for password generation
    function handleGeneratePassword() {
        // Add random password to the input
        const input = document.getElementById("securesend_password");
        input.value = password.randomPassword({length: 16});
        input.type = "text";

        // Add dirty class to trigger animation
        const DIRTY_CLASS = "is-dirty";
        if (!input.parentElement.classList.contains(DIRTY_CLASS)) {
            input.parentElement.classList.add(DIRTY_CLASS)
        }
    }

    // Event handler for password visibility toggle
    function handleTogglePassVisibility() {
        const input = document.getElementById("securesend_password");
        if (input.type === "password") {
            input.type = "text";
        } else {
            input.type = "password";
        }
    }

    // Event handler for "next" button on the permissions page
    async function handlePermissionsNext() {
        // Add password to the bundle
        const pass = document.getElementById("securesend_password").value;

        if (currentFileNum === -1) {
            const name = `Encrypted Files.zip`;
            const output = fs.createWriteStream(name);

            let archive = archiver.create('zip-encrypted', { zlib: { level: 8 }, encryptionMethod: 'aes256', password: pass });
            archive.pipe(output);

            for (const file of bundle.files) {
                if (!file.name.endsWith(".pdf")) {
                    const string = await fileToString(file);
                    archive.append(string, { name: file.name })
                }
            }

            archive.finalize();
            bundle.blob = await readFile(name);

            bundle.files = bundle.files.filter(file => file.name.endsWith(".pdf"));
        } else {
            // Get permission and add to bundle
            const print = document.getElementById("checkbox-print").checked;
            const modify = document.getElementById("checkbox-modify").checked;
            const annotate = document.getElementById("checkbox-annotate").checked;
            const forms = document.getElementById("checkbox-forms").checked;
            bundle.permissionsArray.push({ print, modify, annotate, forms, pass });
        }

        currentFileNum++;
        if (currentFileNum < bundle.files.length) {
            loadPermissions();
        } else {
            handleDone();
        }
    }

    // Event handler for file selection on the first page
    function handleFileSelected(event) {
        // Add file to bundle
        bundle.files = Array.from(document.getElementById("securesend_upload_input").files);
        bundle.permissionsArray = [];

        if (containsNonPdf(bundle.files)) {
            currentFileNum = -1;
        } else {
            currentFileNum = 0;
        }

        // Load the next page: permissions
        loadPermissions();
    }

    // Loads the permissions page
    function loadPermissions() {
        fetch(urls.permissions)
            .then(response => response.text())
            .then(data => {
                document.getElementById("securesend_dialog_body").innerHTML = data;
                document.getElementById("securesend_permissions_next_button").addEventListener("click", handlePermissionsNext);
                document.getElementById("securesend_password_generate_button").addEventListener("click", handleGeneratePassword);
                document.getElementById("securesend_password_show_button").addEventListener("click", handleTogglePassVisibility);

                runScript(urls.mdlScript);

                if (currentFileNum === -1) {
                    document.getElementsByClassName("securesend_permissions_container")[0].remove();
                    document.getElementsByClassName("securesend_permissions_title")[0].innerHTML += " for encrypted zip"
                } else {
                    document.getElementsByClassName("securesend_permissions_title")[0].innerHTML += bundle.files[currentFileNum].name;
                }
            }).catch(error => {
                console.log(error)
            });
    }

    // Event handler for the close button
    function handleClose() {
        // Start close animation
        document.getElementById("securesend_dialog").className += " securesend_dialog_closed";

        // Close dialog in 100ms
        setTimeout(() => {
            document.getElementById("securesend_ui_container").remove();
        }, 100);
    }

    // Event handler for toolbar lock icon
    function handleOpen() {
        const emailId = currentCompose.email_id().split(":").pop()
        bundle = { emailId, email };

        // Create container
        const uiContainer = document.createElement("div");
        uiContainer.className = "securesend_ui_container";
        uiContainer.id = "securesend_ui_container";

        // Create backdrop
        const backdrop = document.createElement("div");
        backdrop.className = "securesend_backdrop";
        uiContainer.append(backdrop)

        // Create dialog
        const dialog = document.createElement("div");
        dialog.className = "securesend_dialog";
        dialog.id = "securesend_dialog";

        // Create dialog container
        const dialogContainer = document.createElement("div");
        dialogContainer.className = "securesend_dialog_container";
        dialogContainer.append(dialog)
        uiContainer.append(dialogContainer);

        // Load page
        fetch(urls.dialog)
            .then(response => response.text())
            .then(data => {
                dialog.innerHTML = data;
                document.getElementById("securesend_close").addEventListener("click", handleClose);


                fetch(urls.upload)
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

    // Creates handler with compose window and sends the right id
    function getOpenHandler(compose) {
        return function () {
            let c = compose
            currentCompose = c;
            handleOpen(c);
        }
    }

    // loader-code: wait until gmailjs has finished loading, before triggering actual extensiode-code.
    const loaderId = setInterval(() => {
        if (!window._gmailjs) {
            return;
        }

        clearInterval(loaderId);
        startExtension(window._gmailjs);
    }, 100);

    // Ran when gmail page loads
    function startExtension(gmail) {
        console.log("Securesend loading...");
        window.gmail = gmail;

        gmail.observe.on("load", () => {
            console.log("Securesend successfully loaded.");

            email = gmail.get.user_email();

            gmail.observe.on("compose", function (compose, type) {
                const iconButton = document.createElement("div");
                iconButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M17 9.761v-4.761c0-2.761-2.238-5-5-5-2.763 0-5 2.239-5 5v4.761c-1.827 1.466-3 3.714-3 6.239 0 4.418 3.582 8 8 8s8-3.582 8-8c0-2.525-1.173-4.773-3-6.239zm-8-4.761c0-1.654 1.346-3 3-3s3 1.346 3 3v3.587c-.927-.376-1.938-.587-3-.587s-2.073.211-3 .587v-3.587zm3 17c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6zm2-6c0 1.104-.896 2-2 2s-2-.896-2-2 .896-2 2-2 2 .896 2 2z"/></svg>';
                iconButton.className = "securesend_button";

                const button = gmail.tools.add_compose_button(compose, iconButton, getOpenHandler(compose), "");
                button.attr("class", "securesend_button_container");
                button.attr("style", "margin-left: 12px;");
            });

        });
    }
})();