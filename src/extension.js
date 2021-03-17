"use strict";

(function () {
    // Imports
    const password = require('secure-random-password');
    const $ = require("jquery");
    const archiver = require('archiver');
    archiver.registerFormat('zip-encrypted', require("archiver-zip-encrypted"));
    const fs = require('browserify-fs');

    // State Variables
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

    // Utility functions
    // Function used to run scripts from a url
    function runScript(url) {
        $.getScript(url, function (data, textStatus, jqxhr) {
            console.log(data); // Data returned
            console.log(textStatus); // Success
            console.log(jqxhr.status); // 200
            console.log("Script ran");
        });
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
    // End of utility functions

    // Lifecycle functions, in order of execution
    // Receive urls from extensionInjector
    document.addEventListener("securesendUiSrcTransfer", function (event) {
        urls = event.detail;
    });

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

    // Creates handler with compose window and sends the right id
    function getOpenHandler(compose) {
        return function () {
            // Swaps the correct compose into the namespace variable
            let c = compose
            currentCompose = c;
            handleOpen();
        }
    }

    // Event handler for toolbar lock icon
    function handleOpen() {
        // Run setup scripts
        runScript(urls.mdlScript);
        runScript(urls.selectScript);

        const recipients = currentCompose.recipients({flat: true}).map(recipient => recipient.replace(/^.*</, "").replace(/>.*$/, ""));
        const emailId = currentCompose.email_id().split(":").pop()
        bundle = { emailId, email, recipients };

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

                return fetch(urls.upload);
            })
            .then(response => response.text())
            .then(data => {
                document.getElementById("securesend_dialog_body").innerHTML = data;
                document.getElementById("securesend_upload_input").addEventListener("change", handleFileSelected);
            }).catch(error => {
                console.log(error);
            });

        document.body.append(uiContainer);
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
                // Register mdl components
                componentHandler.upgradeAllRegistered();

                document.getElementById("securesend_dialog_body").innerHTML = data;
                document.getElementById("securesend_permissions_next_button").addEventListener("click", () => handlePermissionsNext(false));
                document.getElementById("securesend_permissions_apply_button").addEventListener("click", () => handlePermissionsNext(true));
                document.getElementById("securesend_password_generate_button").addEventListener("click", handleGeneratePassword);
                document.getElementById("securesend_password_show_button").addEventListener("click", handleTogglePassVisibility);

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
    async function handlePermissionsNext(applyAll) {
        // Add password to the bundle
        const pass = document.getElementById("securesend_password").value;

        // Default permissions
        let print = true;
        let modify = true;
        let annotate = true;
        let forms = true;

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
            bundle.pass = pass;

            bundle.files = bundle.files.filter(file => file.name.endsWith(".pdf"));
        } else {
            // Get permission and add to bundle
            print = document.getElementById("checkbox-print").checked;
            modify = document.getElementById("checkbox-modify").checked;
            annotate = document.getElementById("checkbox-annotate").checked;
            forms = document.getElementById("checkbox-forms").checked;

            bundle.permissionsArray.push({ print, modify, annotate, forms, pass });
        }
        currentFileNum++;

        // If apply all, fill the permissions array
        while (applyAll && currentFileNum < bundle.files.length) {
            bundle.permissionsArray.push({ print, modify, annotate, forms, pass });
            currentFileNum++;
        }

        if (currentFileNum < bundle.files.length) {
            loadPermissions();
        } else {
            loadCoordinateSettings();
        }
    }

    function loadCoordinateSettings() {

        fetch(urls.coordinateSettings)
            .then(response => response.text())
            .then(data => {
                document.getElementById("securesend_dialog_body").innerHTML = data;
                document.getElementById("securesend_coordinate_settings_next_button").addEventListener("click", loadCoordinate);

                /*
                document.getElementById("checkbox-same").addEventListener("change", handleSameChecked);

                // Remove checkbox if there's no recipients
                if (bundle.recipients.length === 0) {
                    document.getElementById("checkbox-same").parentElement.style.display = "none";
                }
                */

                const addButton = document.getElementById("securesend_recipient_add");
                const tbody = document.getElementById("securesend_coordinate_tbody");
                const addRow = document.getElementById("securesend_add_row");
                let recipientIndex = 1;

                const getSelectIndex = () => recipientIndex * 2;
                const getAddressIndex = () => recipientIndex * 2 + 1;

                function insertRow(recipientName) {
                    if (Object.prototype.toString.call(recipientName) !== "[object String]") {
                        recipientName = `Recipient ${recipientIndex}`;
                    }

                    const rowContent = `
                    <td><h6>${recipientName}</h6></td>
                    <td>
                        <div class="mdl-textfield mdl-js-textfield getmdl-select securesend_coordinate_method_input">
                            <input type="text" value="" class="mdl-textfield__input" id="sample${getSelectIndex()}" readonly>
                            <input type="hidden" value="" name="sample${getSelectIndex()}">
                            <label for="sample${getSelectIndex()}" class="mdl-textfield__label">Method</label>
                            <ul for="sample${getSelectIndex()}" class="mdl-menu mdl-menu--bottom-left mdl-js-menu">
                                <li class="mdl-menu__item" data-selected="true">Email</li>
                                <li class="mdl-menu__item">Don't Send</li>
                            </ul>
                        </div>
                    </td>
                    <td>
                        <div class="mdl-textfield mdl-js-textfield securesend_coordinate_address_input">
                            <input class="mdl-textfield__input" type="text" id="sample${getAddressIndex()}">
                            <label class="mdl-textfield__label" for="sample${getAddressIndex()}">Address</label>
                        </div>
                    </td>
                `;

                    recipientIndex++;
                    const row = document.createElement("tr");
                    row.innerHTML = rowContent;
                    tbody.insertBefore(row, addRow);

                    // Reregister elements
                    componentHandler.upgradeAllRegistered();
                    getmdlSelect.init(".getmdl-select");
                }

                addButton.addEventListener("click", insertRow);

                if (bundle.recipients.length === 0) {
                    insertRow();
                } else {
                    bundle.recipients.forEach(insertRow);
                }

            }).catch(error => {
                console.log(error)
            });
    }

    /*
    function handleSameChecked(event) {
        if (event.target.checked) {
            document.getElementById("securesend_address").parentElement.style.display = "none";
        } else {
            document.getElementById("securesend_address").parentElement.style.display = "block";
        }
    }
    */

    function loadCoordinate() {
        /*
        // Revise recipients if box isn't checked
        const same = document.getElementById("checkbox-same");
        if (!same.checked) {
            const address = document.getElementById("securesend_address").value;
            bundle.recipients = [address];
        }
        */

        // Create iframe with the encrypt url
        const iframe = document.createElement("iframe");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.setAttribute("src", urls.coordinate)
        encryptIFrame = iframe;

        // Add the iframe to the dialog
        const body = document.getElementById("securesend_dialog_body");
        body.innerHTML = '';
        body.appendChild(iframe);

        window.addEventListener("message", handleMessageReceived);
    }

    function loadEncrypt() {
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

    // Ran when the encryption page loads
    // Sends the bundle for encryption
    function handleMessageReceived(event) {
        const { data } = event;
        if (data === "securesend_loaded") {
            console.log("securesend loaded")
            encryptIFrame.contentWindow.postMessage(bundle, "*");
        } else if (data === "securesend_sent") {
            loadEncrypt();
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
})();