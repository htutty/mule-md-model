const fs = require('fs');

// if (process.argv.length <= 3) {
//     console.log("Error: XML file not specified.");
//     console.log("usage: node transformToJson.js <path/to/mule-xml.xml> <output.json>");
//     process.exit(1);
// }

module.exports = function parseXml2Json(inputfile) {
    const text = fs.readFileSync(inputfile, 'utf-8');
    // console.log(text);

    var DOMParser = require('xmldom').DOMParser;
    const parser = new DOMParser();
    let dom  = parser.parseFromString(text, "text/xml");

    // console.log(xmlData);
    // 先頭のmuleノードに移動する
    const muleNode = dom.documentElement;

    console.log("- muleNode= " + muleNode.tagName);

    // for(var node in muleNode.childNodes) {
    //     console.log(JSON.stringify(node));
    // }
    const slices = inputfile.split("\\");
    var muleData = {name: slices[slices.length - 1]};
    muleData.flows = parseFirstLevelNodes(muleNode.childNodes);

    // console.log("-------- MuleData");
    // console.log(JSON.stringify(muleData));
    // fs.writeFileSync(outputfile, JSON.stringify(muleData), 'utf-8');

    return muleData;
}

// muleタグ内の flow, sub-flow などを抽出
function parseFirstLevelNodes(nodes) {
    var flows = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.tagName == undefined) {
            continue;
        }
        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "http:listener-config":
                console.log("http:listener-config skipped");
                break;
            case "flow":
                // flow のパース処理
                var flow = {name: node.getAttribute("name"), type:"flow"};
                flow.components = parseInnerFlowNodes(node.childNodes);
                flows.push(flow);
                break;
            case "sub-flow":
                // sub-flow のパース処理
                var subflow = {name: node.getAttribute("name"), type:"sub-flow"};
                subflow.components = parseInnerFlowNodes(node.childNodes);
                flows.push(subflow);
                break;
        }
    }
    return flows;
}


// flow, sub-flow タグの中身である各種コンポーネント情報を拾う
function parseInnerFlowNodes(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }
        console.log("- node = " + node.tagName);

        // 複数層にならないコンポーネントかどうかを先に判断する
        if( ! isLayerFreeComponentProcess(node, components) ) {
            // 複数層に跨り得るコンポーネントはそれぞれチェック
            switch(node.tagName) {
                case "try":
                    // try のパース処理 ()
                    var cmp = {name: node.getAttribute("doc:name"), type:"try",
                                docid: node.getAttribute("doc:id")};
                    cmp.children = parseInnerTryNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "choice":
                    // choice のパース処理
                    var cmp = {name: node.getAttribute("doc:name"), type:"choice_",
                                docid: node.getAttribute("doc:id")};
                    cmp.children = parseInnerChoiceNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "ee:transform":
                    // ee:transform のパース処理
                    var cmp = {name: node.getAttribute("doc:name"), type:"transform",
                                    docid: node.getAttribute("doc:id")};
                    cmp.children = parseInnerTransformNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "error-handler":
                    // error-handler のパース処理
                    var cmp = {name: "error-handler", type:"error-handler",
                                    docid: node.getAttribute("doc:id")};
                    cmp.children = parseInnerErrorHandlerNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "until-successful":
                    // until-successful のパース処理
                    var cmp = {name: node.getAttribute("doc:name"), type:"until-successful",
                                    docid: node.getAttribute("doc:id"), maxRetries: node.getAttribute("maxRetries"),
                                    millisBetweenRetries: node.getAttribute("millisBetweenRetries")};
                    cmp.children = parseInnerFlowNodes(node.childNodes);
                    components.push(cmp);
                    break;
                case "http:listener":
                        // http:listener のパース処理  
                        var cmp = {name: "http-listener", type: "http-listener",
                                        docid: node.getAttribute("doc:id"), path: node.getAttribute("path"),
                                        configRef: node.getAttribute("config-ref") };
                        cmp.children = parseInnerHttpListenerNode(node.childNodes);
                        components.push(cmp);
                    break;
                case "file:write":
                    // file:write のパース処理  
                    var cmp = {name: node.getAttribute("doc:name"), type:"file-write",
                                    docid: node.getAttribute("doc:id"), path: node.getAttribute("path"),
                                    configRef: node.getAttribute("config-ref") };
                    cmp.children = parseInnerFileWriteNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "ftp:write":
                    // ftp:write のパース処理  
                    var cmp = {name: node.getAttribute("doc:name"), type:"ftp-write",
                                    docid: node.getAttribute("doc:id"), path: node.getAttribute("path"),
                                    configRef: node.getAttribute("config-ref") };
                    cmp.children = parseInnerFtpWriteNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "ftp:read":
                    // ftp:read のパース処理  
                    var cmp = {name: node.getAttribute("doc:name"), type:"ftp-read",
                                    docid: node.getAttribute("doc:id"), path: node.getAttribute("path"),
                                    configRef: node.getAttribute("config-ref") };
                    cmp.children = [];
                    components.push(cmp);
                    break;
                case "s3:put-object":
                    // ftp:write のパース処理  
                    var cmp = {name: node.getAttribute("doc:name"), type:"s3-putobject",
                                    docid: node.getAttribute("doc:id"), path: node.getAttribute("path"),
                                    configRef: node.getAttribute("config-ref") };
                    cmp.children = parseInnerS3PutObjectNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "os:retrieve":
                    // os:retrieve のパース処理  
                    var cmp = {name: node.getAttribute("doc:name"), type:"os-retrieve",
                                    docid: node.getAttribute("doc:id"), objectStore: node.getAttribute("objectStore"),
                                    key: node.getAttribute("key") };
                    cmp.children = parseInnerObjectStoreRetrieveNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "os:store":
                    // os:store のパース処理  
                    var cmp = {name: node.getAttribute("doc:name"), type:"os-store",
                                    docid: node.getAttribute("doc:id"), objectStore: node.getAttribute("objectStore"),
                                    key: node.getAttribute("key") };
                    cmp.children = parseInnerObjectStoreStoreNode(node.childNodes);
                    components.push(cmp);
                    break;        
            }
        }
    
    }

    return components;
}


function isLayerFreeComponentProcess(node, components) {
    let isFree = false;

    switch(node.tagName) {
        case "logger":
            // logger のパース処理 
            var cmp = {name: node.getAttribute("doc:name"), type:"logger", 
                        docid: node.getAttribute("doc:id"), message: node.getAttribute("message")};
            cmp.children = [];
            components.push(cmp);
            isFree=true;
            break;
        case "flow-ref":
            // flow-ref のパース処理 
            var cmp = {name: node.getAttribute("doc:name"), type:"flow-ref", 
                        docid: node.getAttribute("doc:id"), refFlowName: node.getAttribute("name")};
            cmp.children = [];
            components.push(cmp);
            isFree=true;
            break;
        case "raise-error":
            // raise-error のパース処理 
            var cmp = {name: node.getAttribute("doc:name"), type:"raise-error", 
                        docid: node.getAttribute("doc:id"), errorType: node.getAttribute("type"), 
                        description: node.getAttribute("description")};
            cmp.children = [];
            components.push(cmp);
            isFree=true;
            break;
        case "set-variable":
            // set-variable のパース処理
            var cmp = {name: node.getAttribute("doc:name"), type:"set-variable",
                        docid: node.getAttribute("doc:id"), value: node.getAttribute("value"),
                        variableName: node.getAttribute("variableName")};
            cmp.children = [];
            components.push(cmp);
            isFree=true;
            break;
        case "http:request":
            // http:request のパース処理
            var cmp = {name: node.getAttribute("doc:name"), type:"http_request",
                            docid: node.getAttribute("doc:id")};
            cmp.children = [];
            components.push(cmp);
            isFree=true;
            break;
    
    }
    return isFree;
}

// <try>の内部ノードをパースする
function parseInnerTryNode(nodes) {
    return parseInnerFlowNodes(nodes);
}

// <choice>タグの内部ノードをパースする
function parseInnerChoiceNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        // 複数層にならないコンポーネントかどうかを先に判断する
        if( ! isLayerFreeComponentProcess(node, components) ) {
            switch(node.tagName) {
                case "when":
                    // when のパース処理 ()
                    var cmp = {name: getNameFromExpr(node.getAttribute("expression")), type:"when",
                                docid: node.getAttribute("doc:id"), expression: node.getAttribute("expression")};
                    cmp.children = parseInnerChoiceNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "otherwise":
                    // otherwise のパース処理 ()
                    var cmp = {name: "otherwise", type:"otherwise",
                                docid: node.getAttribute("doc:id")};
                    cmp.children = parseInnerChoiceNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "choice":
                    // choice のパース処理
                    var cmp = {name: node.getAttribute("doc:name"), type:"choice_",
                                docid: node.getAttribute("doc:id")};
                    cmp.children = parseInnerChoiceNode(node.childNodes);
                    components.push(cmp);
                    break;
                case "ee:transform":
                    // ee:transform のパース処理
                    var cmp = {name: node.getAttribute("doc:name"), type:"transform",
                                    docid: node.getAttribute("doc:id")};
                    cmp.children = parseInnerTransformNode(node.childNodes);
                    components.push(cmp);
                    break;
            }
        }
    }

    return components;
}

//
function parseInnerTransformNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "ee:message":
                // ee:message のパース処理 ()
                var cmp = {name: "message", type:"message",
                            docid: "" };
                cmp.children = parseInnerMessageNode(node.childNodes);
                components.push(cmp);
                break;
            case "ee:variables":
                // ee:variables のパース処理 ()
                var cmp = {name: "variables", type:"variables",
                            docid: "" };
                cmp.children = parseInnerVariablesNode(node.childNodes);
                components.push(cmp);
                break;
        }
    }

    return components;
}


function parseInnerMessageNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "ee:set-payload":
                // ee:set-payload のパース処理 ()
                var cmp = {name: "set-payload", type:"ee_set-payload",
                            docid: node.getAttribute("doc:id"), dwtext: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
        }

    }

    return components;
}


function parseInnerVariablesNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "ee:set-variable":
                // ee:set-variable のパース処理 ()
                var cmp = {name: node.getAttribute("variableName"), type:"ee_set-variable", docid: "",
                            variableName: node.getAttribute("variableName"), dwtext: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
        }
    }

    return components;
}


function parseInnerErrorHandlerNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "on-error-propagate":
                // on-error-propagate のパース処理 ()
                var cmp = {name: node.getAttribute("doc:name"), type:"on-error-propagate", errorType:node.getAttribute("type"),
                            docid: node.getAttribute("doc:id"), enableNotifications: node.getAttribute("enableNotifications"),
                            logException: node.getAttribute("logException")};
                cmp.children = parseInnerFlowNodes(node.childNodes);
                components.push(cmp);
                break;
            case "on-error-continue":
                // on-error-continue のパース処理 ()
                var cmp = {name: node.getAttribute("doc:name"), type:"on-error-continue", errorType:node.getAttribute("type"),
                            docid: node.getAttribute("doc:id"), enableNotifications: node.getAttribute("enableNotifications"),
                            logException: node.getAttribute("logException")};
                cmp.children = parseInnerFlowNodes(node.childNodes);
                components.push(cmp);
                break;
        }
    }

    return components;
}

// when専用： expression から名前となる文字列を取得
function getNameFromExpr(str) {
    // パラメータの文字列を"\n"で分割して１行目の文字列を取得する
    var lines = str.split("\n");
    if( lines[0].length > 50 ) {
        // 50文字目までの後ろに ".." を付けた文字列を返却
        return lines[0].substring(0, 50) + "..";
    } else {
        // 50文字以下ならそのまま1行目の文字列を返却
        return lines[0];
    }
}


// file:write ノードの中身 file:content を処理する
function parseInnerFileWriteNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "file:content":
                // when のパース処理 ()
                var cmp = {name: "file-content", type:"file-content",
                            content: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
        }
    }

    return components;
}

// http:listener ノードの中身 http:response, error-response を処理する
function parseInnerHttpListenerNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "http:response":
                // http:response のパース処理 ()
                var cmp = {name: "http-response", type:"http-response",
                            statusCode:  node.getAttribute("statusCode") };
                cmp.children = parseInnerHttpResponseNode(node.childNodes);
                components.push(cmp);
                break;
            case "http:error-response":
                // http:error-response のパース処理 ()
                var cmp = {name: "http-error-response", type:"http-error-response",
                            statusCode:  node.getAttribute("statusCode") };
                cmp.children = parseInnerHttpResponseNode(node.childNodes);
                components.push(cmp);
                break;
        }
    }

    return components;
}

// http:response ノードの中身 http:headers, http:bodyを処理する
function parseInnerHttpResponseNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "http:headers":
                // http:headers のパース処理 ()
                var cmp = {name: "http-headers", type:"http-headers",
                            content: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
            case "http:body":
                // http:body のパース処理 ()
                var cmp = {name: "http-body", type:"http-body",
                            content: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
        }
    }

    return components;
}


// ftp:write ノードの中身 ftp:content を処理する
function parseInnerFtpWriteNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "ftp:content":
                // ftp:content のパース処理 ()
                var cmp = {name: "ftp-content", type:"ftp-content",
                            content: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
        }
    }

    return components;
}


// s3:put-object ノードの中身 s3:content を処理する
function parseInnerS3PutObjectNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "s3:content":
                // when のパース処理 ()
                var cmp = {name: "s3-content", type:"s3-content",
                            content: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
        }
    }

    return components;
}

// os:retrieve ノードの中身 os:default-value を処理する
function parseInnerObjectStoreRetrieveNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "os:default-value":
                // when のパース処理 ()
                var cmp = {name: "os-defaultvalue", type:"os-defaultvalue",
                            content: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
        }
    }

    return components;
}

// os:store ノードの中身 os:value を処理する
function parseInnerObjectStoreStoreNode(nodes) {
    let components = [];

    for(var i=0; i < nodes.length; i++) {
        const node = nodes[i];

        if(node.tagName == undefined) {
            continue;
        }

        console.log("- node = " + node.tagName);

        switch(node.tagName) {
            case "os:value":
                // when のパース処理 ()
                var cmp = {name: "os-value", type:"os-value",
                            content: node.textContent };
                cmp.children = [];
                components.push(cmp);
                break;
        }
    }

    return components;
}

