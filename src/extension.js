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

    let fileIndex = 1;

    let recipientIndex = 1;

    // Utility functions
    // Function used to run scripts from a url
    function runScript(url) {
        $.getScript(url, function (data, textStatus, jqxhr) {

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
    function containsPdf(fileList) {
        for (const file of fileList) {
            if (file.name.endsWith(".pdf")) {
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
        // Do not open if it is already open
        if (document.getElementById("securesend_dialog_container")) {
            return;
        }

        // Run setup scripts
        runScript(urls.mdlScript);
        runScript(urls.selectScript);

        const recipients = currentCompose.recipients({flat: true}).map(recipient => recipient.replace(/^.*</, "").replace(/>.*$/, ""));
        const emailId = currentCompose.email_id().split(":").pop()
        bundle = { emailId, email, recipients };

        /*
        // Create container
        const uiContainer = document.createElement("div");
        uiContainer.className = "securesend_ui_container";
        uiContainer.id = "securesend_ui_container";
        */

        // Create dialog
        const dialog = document.createElement("div");
        dialog.className = "securesend_dialog";
        dialog.id = "securesend_dialog";

        // Create dialog container
        const dialogContainer = document.createElement("div");
        dialogContainer.className = "securesend_dialog_container";
        dialogContainer.id = "securesend_dialog_container";
        dialogContainer.append(dialog)

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


                var dragging = false;
                // Initial mouse x, y
                var iX, iY;
                // Initial translate x, y
                var tiX, tiY;
                // Actual translate x and y;
                var tX = -dialogContainer.clientWidth / 2;
                var tY = -dialogContainer.clientHeight / 2
                dialogContainer.style.transform = `translate(${tX}px, ${tY}px)`;
                function dragMousedown(event) {
                    iX = event.clientX;
                    iY = event.clientY;

                    tiX = tX;
                    tiY = tY;

                    dragging = true;
                }
                function dragMouseup(event) {
                    dragging = false;
                }
                function dragMousemove(event) {
                    if (dragging) {
                        const mouseDeltaX = event.clientX - iX;
                        const mouseDeltaY = event.clientY - iY;

                        tX = mouseDeltaX + tiX;
                        tY = mouseDeltaY + tiY;

                        dialogContainer.style.transform = `translate(${tX}px, ${tY}px)`;
                    }
                }

                const header = document.getElementsByClassName("securesend_header")[0];
                header.addEventListener("mousedown", dragMousedown);
                header.addEventListener("mouseup", dragMouseup)
                header.addEventListener("mousemove", dragMousemove);
            }).catch(error => {
                console.log(error);
            });

        document.body.append(dialogContainer);
    }

    // Event handler for the close button
    function handleClose() {
        // Start close animation
        document.getElementById("securesend_dialog").className += " securesend_dialog_closed";

        // Close dialog in 100ms
        setTimeout(() => {
            document.getElementById("securesend_dialog_container").remove();
        }, 100);

    }

    // Event handler for file selection on the first page
    function handleFileSelected(event) {
        // Add file to bundle
        bundle.files = Array.from(document.getElementById("securesend_upload_input").files);
        bundle.permissionsArray = [];

        // Load the next page: permissions
        loadPermissions();
    }

    // Loads the permissions page
    function loadPermissions() {
        fetch(urls.security)
            .then(response => response.text())
            .then(data => {
                document.getElementById("securesend_dialog_body").innerHTML = data;

                const tbody = document.getElementById("securesend_security_tbody");

                // Event handler for password visibility toggle
                function handleTogglePassVisibility(event) {
                    const cell = event.target.parentElement.parentElement;
                    const input = cell.getElementsByTagName("input")[0];

                    if (input.type === "password") {
                        input.type = "text";
                        event.target.innerText = "Hide";
                    } else {
                        input.type = "password";
                        event.target.innerText = "Show";
                    }
                }

                // Event handler for password generation
                function handleGeneratePassword(event) {
                    const row = event.target.parentElement.parentElement;
                    const input = row.getElementsByTagName("input")[0];
                    const visibilityButton = row.getElementsByTagName("button")[0];

                    // Add random password to the input
                    input.value = password.randomPassword({length: 16});
                    input.type = "text";
                    visibilityButton.innerText = "Hide";

                    // Add dirty class to trigger animation
                    const DIRTY_CLASS = "is-dirty";
                    if (!input.parentElement.classList.contains(DIRTY_CLASS)) {
                        input.parentElement.classList.add(DIRTY_CLASS)
                    }
                }

                function insertRow(filename, zip) {
                    const rowContent = `
                        <td>
                            ${
                                // Choose the correct icon
                                zip ?
                                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 0l-11 6v12.131l11 5.869 11-5.869v-12.066l-11-6.065zm-1 21.2l-8-4.268v-8.702l8 4.363v8.607zm10-4.268l-8 4.268v-9.793l-8.867-4.837 7.862-4.289 9.005 4.969v9.682zm-4.408-4.338l1.64-.917-.006.623-1.64.918.006-.624zm1.653-2.165l-1.641.919-.006.624 1.641-.918.006-.625zm0-1.19l-1.641.919-.006.624 1.641-.918.006-.625zm-3.747-.781l1.645-.96-.519-.273-1.646.959.52.274zm4.208 6.33l-.486-1.865-1.641.919-.523 2.431c-.229 1.105.422 1.31 1.311.812.886-.497 1.548-1.437 1.339-2.297zm-1.335 1.684c-.411.23-.821.262-.817-.136.005-.41.422-.852.835-1.083.407-.228.81-.25.806.165-.005.398-.415.825-.824 1.054zm-4.349-10.625l-.519-.274-1.646.96.52.274 1.645-.96zm-1.559-.826l-1.646.96.523.277 1.646-.96-.523-.277zm1.992 2.885l1.644-.958-.515-.274-1.647.958.518.274zm3.001 1.744l1.646-.96-.52-.273-1.645.959.519.274zm-6.029-5.177l-1.645.96.516.274 1.647-.959-.518-.275zm1.992 2.886l1.646-.96-.52-.274-1.645.959.519.275zm3.058 1.689l1.646-.959-.518-.274-1.646.96.518.273z"/></svg>'
                                :
                                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M16 0h-14v24h20v-18l-6-6zm0 3l3 3h-3v-3zm-12 19v-20h10v6h6v14h-16z"/></svg>'
                            }
                            <span id="securesend_filename_${fileIndex}">${filename}</span>
                        </td>
                        <td>
                            <div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label securesend_security_password_container">
                                <input class="mdl-textfield__input" type="password" id="securesend_password_${fileIndex}">
                                <label class="mdl-textfield__label" for="securesend_password">Password</label>
                            </div>
                            <div class="securesend_security_show_container">
                                <button id="securesend_password_visibility_${fileIndex}" class="mdl-button mdl-js-button mdl-button--raised securesend_security_action_button">
                                    Show
                                </button>
                            </div>
                        </td>
                        <td>
                            <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored securesend_security_action_button" id="securesend_generate_${fileIndex}">
                                Generate
                            </button>

                            ${
                                !zip ?
                                `<button class="mdl-button mdl-js-button mdl-button--raised securesend_security_action_button" id="securesend_permissions_${fileIndex}">
                                    Permissions
                                </button>`
                                :
                                ''
                            }

                            <ul class="mdl-menu mdl-menu--bottom-left mdl-js-menu mdl-js-ripple-effect" for="securesend_permissions_${fileIndex}">
                                <li class="mdl-menu__item securesend_security_permissions_item">
                                    <label class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect" for="checkbox_print_${fileIndex}">
                                        <input type="checkbox" id="checkbox_print_${fileIndex}" class="mdl-checkbox__input" checked>
                                        <span class="mdl-checkbox__label">Printing</span>
                                    </label>
                                </li>
                                <li class="mdl-menu__item securesend_security_permissions_item">
                                    <label class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect" for="checkbox_modify_${fileIndex}">
                                        <input type="checkbox" id="checkbox_modify_${fileIndex}" class="mdl-checkbox__input" checked>
                                        <span class="mdl-checkbox__label">Modifying</span>
                                    </label>
                                </li>
                                <li class="mdl-menu__item securesend_security_permissions_item">
                                    <label class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect" for="checkbox_annotate_${fileIndex}">
                                        <input type="checkbox" id="checkbox_annotate_${fileIndex}" class="mdl-checkbox__input" checked>
                                        <span class="mdl-checkbox__label">Annotating</span>
                                    </label>
                                </li>
                                <li class="mdl-menu__item securesend_security_permissions_item">
                                    <label class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect" for="checkbox_forms_${fileIndex}">
                                        <input type="checkbox" id="checkbox_forms_${fileIndex}" class="mdl-checkbox__input" checked>
                                        <span class="mdl-checkbox__label">Filling Forms</span>
                                    </label>
                                </li>
                            </ul>
                        </td>
                    `;

                    const row = document.createElement("tr");
                    row.innerHTML = rowContent;

                    tbody.append(row);

                    document.getElementById(`securesend_password_visibility_${fileIndex}`).addEventListener("click", handleTogglePassVisibility);
                    document.getElementById(`securesend_generate_${fileIndex}`).addEventListener("click", handleGeneratePassword);

                    componentHandler.upgradeAllRegistered();

                    const menu = row.querySelector(".mdl-menu");
                    row.querySelectorAll('.mdl-menu__item').forEach(item => {
                        item.removeEventListener("click", menu.MaterialMenu.boundItemClick_);
                        item.addEventListener("click", event => event.stopPropagation());
                    })

                    fileIndex++;
                }

                function buildNonSingle() {
                    fileIndex = 1;

                    if (containsNonPdf(bundle.files)) {
                        insertRow("Encryped Zip", true);
                    }

                    const pdfFiles = bundle.files.filter(file => file.name.endsWith(".pdf"));
                    for (const pdfFile of pdfFiles) {
                        insertRow(pdfFile.name, false);
                    }
                }

                function buildSingle() {
                    fileIndex = 1;

                    insertRow("All Files", !containsPdf(bundle.files));
                }

                document.getElementById("securesend_security_next_button").addEventListener("click", handleSecurityNext);
                document.getElementById("securesend_single_password").addEventListener("change", event => {
                    tbody.innerHTML = "";
                    if (event.target.checked) {
                        buildSingle();
                    } else {
                        buildNonSingle();
                    }
                });

                buildNonSingle();
            }).catch(error => {
                console.log(error)
            });
    }

    // Event handler for "next" button on the security page
    async function handleSecurityNext() {
        const isSingle = document.getElementById("securesend_single_password").checked;

        // Get password and permissions from each row
        for (let rowIndex = 1; rowIndex < fileIndex; rowIndex++) {
            const pass = document.getElementById(`securesend_password_${rowIndex}`).value;
            const permissions = {pass};

            const printCheck = document.getElementById(`checkbox_print_${rowIndex}`);
            if (printCheck) {
                permissions.print = printCheck.checked;
                permissions.modify = document.getElementById(`checkbox_modify_${rowIndex}`).checked;
                permissions.annotate = document.getElementById(`checkbox_annotate_${rowIndex}`).checked;
                permissions.forms = document.getElementById(`checkbox_forms_${rowIndex}`).checked;
            }

            bundle.permissionsArray.push(permissions);
        }

        // Process encrypted zip
        if (containsNonPdf(bundle.files)) {
            const name = `Encrypted Files.zip`;
            const output = fs.createWriteStream(name);

            // Password is always the first in the permission array, even on single
            const password = bundle.permissionsArray[0].pass;

            let archive = archiver.create('zip-encrypted', { zlib: { level: 8 }, encryptionMethod: 'aes256', password });
            archive.pipe(output);

            for (const file of bundle.files) {
                if (!file.name.endsWith(".pdf")) {
                    const string = await fileToString(file);
                    archive.append(string, { name: file.name })
                }
            }

            archive.finalize();

            await new Promise(resolve => output.on("finish", resolve));

            bundle.blob = await readFile(name);

            bundle.pass = password;
            bundle.files = bundle.files.filter(file => file.name.endsWith(".pdf"));

            // Fix permission array by removing encrypted zip if not single
            if (!isSingle) {
                bundle.permissionsArray.shift();
            }
        }

        // Fix permission array if single
        if (isSingle) {
            // Copy first for each bundle.files
            while (bundle.permissionsArray.length < bundle.files.length) {
                bundle.permissionsArray.push(bundle.permissionsArray[0]);
            }
        }
        

        loadCoordinateSettings();
    }

    // TODO: Remove, this function is no longer used
    async function handlePermissionsNext(applyAll) {
        // Add password to the bundle
        const pass = document.getElementById("securesend_password").value;

        // Default permissions
        let print = true;
        let modify = true;
        let annotate = true;
        let forms = true;

        if (currentFileNum === -1) {

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
                recipientIndex = 1;

                document.getElementById("securesend_dialog_body").innerHTML = data;

                const addButton = document.getElementById("securesend_recipient_add");
                const tbody = document.getElementById("securesend_coordinate_tbody");
                const addRow = document.getElementById("securesend_add_row");

                document.getElementById("securesend_coordinate_settings_next_button").addEventListener("click", loadCoordinate);

                function deleteRow(event) {
                    const row = event.target.parentElement.parentElement;
                    row.remove();
                }

                function handleMethodChange(event) {
                    const index = parseInt(event.target.id.replace(/^\D*/, ""));
                    const addressInput = document.getElementById(`securesend_address_${index}`).parentElement;
                    const setToEmail = event.target.value.toLowerCase() === "email";
                    addressInput.style.display = setToEmail ? "block" : "none";
                }

                function insertRow(recipientName) {
                    let emailSet = true;
                    if (Object.prototype.toString.call(recipientName) !== "[object String]") {
                        emailSet = false;
                        recipientName = `Recipient ${recipientIndex}`;
                    }

                    const rowContent = `
                        <td><h6 id="securesend_name_${recipientIndex}">${recipientName}</h6></td>
                        <td>
                            <div id="securesend_method_container_${recipientIndex}" class="mdl-textfield mdl-js-textfield getmdl-select securesend_coordinate_method_input">
                                <input type="text" value="" class="mdl-textfield__input" id="securesend_method_${recipientIndex}" readonly>
                                <input type="hidden" value="" name="securesend_method_${recipientIndex}">
                                <label for="securesend_method_${recipientIndex}" class="mdl-textfield__label">Method</label>
                                <ul for="securesend_method_${recipientIndex}" class="mdl-menu mdl-menu--bottom-left mdl-js-menu">
                                    ${emailSet ? '<li class="mdl-menu__item" data-selected="true">Use Same Email</li>' : ''}
                                    <li class="mdl-menu__item" ${emailSet ? '' : 'data-selected="true"'}>Email</li>
                                    <li class="mdl-menu__item">Don't Send</li>
                                </ul>
                            </div>
                        </td>
                        <td>
                            <div style="display: ${emailSet ? 'none' : 'block'}" class="mdl-textfield mdl-js-textfield securesend_coordinate_address_input">
                                <input class="mdl-textfield__input" type="text" id="securesend_address_${recipientIndex}">
                                <label class="mdl-textfield__label" for="securesend_address_${recipientIndex}">Address</label>
                            </div>
                        </td>
                        <td>
                            <span class="securesend_coordinate_delete_row">&times;</span>
                        </td>
                    `;

                    // Insert row
                    const row = document.createElement("tr");
                    row.innerHTML = rowContent;
                    tbody.insertBefore(row, addRow);

                    // Register event handlers
                    document.getElementById(`securesend_method_${recipientIndex}`).addEventListener("change", handleMethodChange);
                    row.getElementsByClassName("securesend_coordinate_delete_row")[0].addEventListener("click", deleteRow);

                    // Reregister elements
                    componentHandler.upgradeAllRegistered();
                    getmdlSelect.init(`#securesend_method_container_${recipientIndex}`);

                    recipientIndex++;
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

    function loadCoordinate() {
        // Revise recipients
        bundle.recipients = [];
        for (let i = 1; i < recipientIndex; i++) {
            const method = document.getElementById(`securesend_method_${i}`);
            const selectedMethod = method.value.toLowerCase();

            if (selectedMethod === "email") {
                const address = document.getElementById(`securesend_address_${i}`);
                bundle.recipients.push(address.value);
            } else if (selectedMethod.includes("same")) {
                const address = document.getElementById(`securesend_name_${i}`);
                bundle.recipients.push(address.innerText);
            }
        }

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