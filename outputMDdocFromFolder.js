//  ファイル関連の操作を提供するオブジェクトを取得
const fs = require('fs');
const path = require('path');

const parseXml2Json = require('./muleTransformToJson.js');

// if (process.argv.length <= 3) {
//     console.log("Error: XML file not specified.");
//     console.log("usage: node transformToJson.js <path/to/mule-xml.xml> <output.json>");
// }

// コマンドライン引数の取得
if (process.argv.length <= 4) {
	console.log("args.length=" + process.argv.length);
	console.log("Usage: node outputMDdocFromFolder.js <path/to/mule-folder> title outputFilePath");
    process.exit(1);
}
const targetFolder = process.argv[2];
const docTitle = process.argv[3];
const outputFilePath = process.argv[4];

// console.log("targetFolder=" + targetFolder);

// flow-refの解決時に使用する
let allFlowHash = {};
let allFlowRefList = [];

let origTargetFolder = targetFolder;
let nowXmlIdx = 0;

let allDwHash = {};

let allOutTexts = [];


searchFolder(targetFolder);

// for (const h in allFlowHash) {
// 	console.log( "allFlowHash[" + h + "] " + ",name=" + allFlowHash[h].name + ",guid=" + allFlowHash[h].guid);
// }

for (var i=0; i < allFlowRefList.length; i++) {
	const flowRef = allFlowRefList[i];
	console.log( "allFlowRefList[" + i + "]: " + "name=" + flowRef.name + ",guid=" + flowRef.guid 
	               + ",refFlowName=" + flowRef.refFlowName  + ",myFlowName=" + flowRef.myFlowName 
				   + ",xmlFileIdx=" + flowRef.xmlFileIdx );
}

// flow-refの情報から、Flow間の関連図を作る
makeFlowRefDiagram();

// markdownファイルとして出力
outputMarkdownFile(outputFilePath);


function searchFolder(targetFolder) {
	console.log("searchFolder() start: " + targetFolder);

	//ファイルとディレクトリのリストが格納される(配列)
	const files = fs.readdirSync(targetFolder);

	const dirList = files.filter((file) => {
		return fs.statSync(path.join(targetFolder, file)).isDirectory();
	});

	const fileList = files.filter((file) => {
		return fs.statSync(path.join(targetFolder, file)).isFile();
	});

	// このフォルダ配下のファイルを検索
	if (fileList.length > 0) {
		for (let i = 0; i < fileList.length; i++) {
			const filename = fileList[i];
			if (filename.indexOf(".xml") >= filename.length - 5) {
				// console.log("found .xml file: " + filename);
				// console.log("path: " + targetFolder);
				parseXmlFile(targetFolder, filename);
			}
			if (filename.indexOf(".dwl") >= filename.length - 5) {
				console.log("found .dwl file: " + filename);
				// console.log("path: " + targetFolder);
				parseDwlFile(targetFolder, filename);
			}
		}
	}

	//  このフォルダのサブフォルダを同様に検索する
	for (let i=0; i < dirList.length; i++) {
		// const subFolder = folder.SubFolders.Item(i);
		searchFolder( targetFolder + "/" + dirList[i]);
	}
}


function parseXmlFile(targetFolder, targetFile) {
	const jsondata = parseXml2Json(targetFolder + "/" + targetFile);

	var targetFilePath = targetFolder.substring(origTargetFolder.length + 1) +
	        "/" + targetFile;
	outputMarkdownFromJson(jsondata, targetFilePath);
	nowXmlIdx++;
}

function outputMarkdownFromJson(muleapp, targetXmlFilePath)
{
	console.log("outputMarkdownFromJson() start: " + targetXmlFilePath);

	let fileText = "## " + targetXmlFilePath + "\r\n";
	fileText = fileText +  "(" + muleapp.flows.length + " flows included)\r\n\r\n"
	var flowText = "";

	// flows
	for( var i=0; i < muleapp.flows.length; i++) {
		var curFlow = muleapp.flows[i];

		var flowHead = "### " + curFlow.name + "\r\n\r\n" ;
		var cmplsText = makeComponentListText(curFlow);
		var cmpdtlText = makeComponentsDetail(i+1, curFlow);

		flowText = flowText + flowHead + cmplsText + cmpdtlText + "\r\n";

		// 内部処理用の全フロー
		var aflow = {name: curFlow.name, guid: 0, type: curFlow.type,
						packageId: 0};
		allFlowHash[curFlow.name] = aflow;
	}

	allOutTexts.push({targetFilePath: targetXmlFilePath, fileText: fileText, diagramText: "", flowsText: flowText});
}


function makeComponentListText(curFlow) {
	var retText = "#### Flow description: [" + curFlow.type + "] " + curFlow.name + "\r\n\r\n";

	// flows.components の数だけループ 
	for (var i=0; i < curFlow.components.length; i++) {
		var curCmp = curFlow.components[i];

		retText = retText + makeComponentText(0, curCmp, curFlow);

		// flow-refの情報を記録する
		if(curCmp.type == "flow-ref") {
			var aFlowRef = {name: curCmp.name, guid: 0, refFlowName: curCmp.refFlowName,
			    myFlowName: curFlow.name, xmlFileIdx: nowXmlIdx };
			allFlowRefList.push(aFlowRef);
		}
	}

	retText = retText + "\r\n";
	return retText;
}

function makeComponentText(nestlv, curCmp, curFlow) {
	var retText = "";
	var cmpText = "1. [" + curCmp.type + "] ";

	switch(curCmp.type) {
		case "set-variable":
			if (isMultiLine(curCmp.value)) {
				cmpText = cmpText + curCmp.name + "(" + curCmp.variableName + "=[...])\r\n";
			} else if (curCmp.value.length > 50) {
				cmpText = cmpText + curCmp.name + "(" + curCmp.variableName + "= " + curCmp.value.substring(0,50) + "...)\r\n";
			} else {
				cmpText = cmpText + curCmp.name + "(" + curCmp.variableName + "= " + curCmp.value + ")\r\n";
			}
			break;

		case "ee_set-variable":
			cmpText = cmpText + curCmp.name + "(" + curCmp.variableName + "=[...])\r\n";
			break;
		case "flow-ref":
			cmpText = cmpText + curCmp.name + " -> [" + curCmp.refFlowName + "](#" + getLinkText(curCmp.refFlowName) + ")\r\n";
			break;
		default: 
			cmpText = cmpText + curCmp.name + "\r\n";
			break;
	}

	retText = retText + indentText(nestlv) + cmpText;

	// さらにchildrenの中身を再帰的に作成していく
	for (var i=0; i < curCmp.children.length; i++) {
		var curCldCmp = curCmp.children[i];
		retText = retText + makeComponentText(nestlv+1, curCldCmp, curFlow);

		// flow-refの情報を記録する
		if(curCldCmp.type == "flow-ref") {
			var aFlowRef = { name: curCldCmp.name, guid: 0, refFlowName: curCldCmp.refFlowName,
				myFlowName: curFlow.name, xmlFileIdx: nowXmlIdx };
			allFlowRefList.push(aFlowRef);
		}
	}

	return retText;
}

function makeComponentsDetail(seq, curFlow) {
	var retText = "";

	// flows.components の数だけループ 
	for (var i=0; i < curFlow.components.length; i++) {
		var curCmp = curFlow.components[i];

		retText = retText + makeComponentDetailText(i+1, "", curCmp);
	}

	if (retText != "") {
		retText = "#### Component detail\r\n\r\n" + retText ;
	}
	
	return retText;
}

function makeComponentDetailText(seq, parentIdx, curCmp) {
	var retText = "";
	var cmpText = "";
	var myIdx = seq + "." ;
	var cmpTmplText = "- " + parentIdx + myIdx + " [" + curCmp.type + "] "+ curCmp.name + "\r\n";

	switch(curCmp.type) {
		case "set-variable":
			if (isMultiLine(curCmp.value) || curCmp.value.length > 50) {
				cmpText = cmpTmplText + "```\r\n" + curCmp.value + "\r\n```\r\n\r\n";
			}
			break;

		case "when":
			if( curCmp.expression.length >= 50 ) {
				cmpText = cmpTmplText + "```\r\n" + curCmp.expression + "\r\n```\r\n\r\n";
			} 
			break;

		case "ee_set-payload":
			cmpText = cmpTmplText + "```\r\n" + curCmp.dwtext + "\r\n```\r\n\r\n";
			break;

		case "ee_set-variable":
			cmpText = cmpTmplText + "```\r\n" + curCmp.dwtext + "\r\n```\r\n\r\n";
			break;
	}

	retText = retText + cmpText;

	// さらにchildrenの中身を再帰的に作成していく
	for (var i=0; i < curCmp.children.length; i++) {
		var curCldCmp = curCmp.children[i];
		retText = retText + makeComponentDetailText(i+1, parentIdx + myIdx, curCldCmp);
	}

	return retText;
}


function parseDwlFile(targetFolder, dwlFile) {
	
	const dwText = readDwlFile(targetFolder + "\\" + dwlFile);
	const targetFilePath = targetFolder.substring(origTargetFolder.length + 1) + "/" + dwlFile;
	let filetext = "## " + targetFilePath + "\r\n";
	filetext = filetext +  "(" + dwText.split("\n").length + " lines included)\r\n\r\n"

	// 全Dataweaveデータが入るHashにこのファイルの内容を登録
	// allDwHash[targetFolder + "\\" + dwlFile] = dwText;

	allOutTexts.push({targetFilePath: targetFilePath, fileText: filetext, diagramText: "", flowsText: "```\r\n" + dwText + "\r\n```\r\n"});
}


function readDwlFile(dwlfilepath) {
    const text = fs.readFileSync(dwlfilepath, 'utf-8');

	// console.log(text);
    return text;
}


function makeFlowRefDiagram() {
	var flowRefIdx = 0;

	for (var i=0; i < allOutTexts.length; i++) {
		var breakFlg = false;
		var refFlowObj = {};
		var flowsObj = {};

		for (var j=flowRefIdx; j < allFlowRefList.length && !breakFlg; j++) {
			var myFlowRef = allFlowRefList[j];

			console.log("# allFlowRefList[" + j + "] = " + 
			    "{ myFlowName=" + myFlowRef.myFlowName + 
			    " ,refFlowName=" + myFlowRef.refFlowName + 
				" ,xmlFileIdx=" + myFlowRef.xmlFileIdx + "}" );

			// xml
			if (myFlowRef.xmlFileIdx == i) {
				console.log("  - myFlowRef.xmlFileIdx = " + i);

				refFlowObj[myFlowRef.myFlowName + "/" + myFlowRef.refFlowName] =
				{fromFlowName: myFlowRef.myFlowName, toFlowName: myFlowRef.refFlowName};

				flowsObj[myFlowRef.myFlowName] = {flowSeq: "0", flowName: myFlowRef.myFlowName};
				flowsObj[myFlowRef.refFlowName] = {flowSeq: "0", flowName: myFlowRef.refFlowName};
			} else {
				breakFlg = true;
				flowRefIdx = j;
			}
		}

		// flowsObjが空でない場合に限り
		if (Object.keys(flowsObj).length > 0) {
			var diagramText = "\r\n```mermaid\r\ngraph LR\r\n" 
			var flowDefText = "";
			var refText = "";
			var flowCnt=1;
			for (var flowName in flowsObj) {
				console.log("  - flowName = " + flowName);

				flowsObj[flowName].flowSeq = "f" + flowCnt;
				flowDefText = flowDefText + flowsObj[flowName].flowSeq + "(\"" + flowsObj[flowName].flowName + "\")\r\n";
				flowCnt++;
			}
			flowDefText = flowDefText + "\r\n";

			for (var refFlowKey in refFlowObj) {
				var fromSeq = flowsObj[refFlowObj[refFlowKey].fromFlowName].flowSeq;
				var toSeq = flowsObj[refFlowObj[refFlowKey].toFlowName].flowSeq;

				refText = refText + fromSeq + " --> " + toSeq + "\r\n";
			}

			diagramText = diagramText + flowDefText + refText;
			diagramText = diagramText + "\r\n```\r\n\r\n";

			allOutTexts[i].diagramText = diagramText;
		}
	}

}


function outputMarkdownFile(outputFilePath) {


	for (var i=0; i < allOutTexts.length; i++) {
		var outText = "";
		outText = outText + "# " + docTitle + "\r\n\r\n";

		var obj = allOutTexts[i];
		outText = outText + obj.fileText;
		outText = outText + obj.diagramText;
		outText = outText + obj.flowsText;

		fs.writeFileSync(getPathToOutFilename(obj.targetFilePath), outText);
	}

	// fs.writeFileSync(outputFilename, outText);
}

function getPathToOutFilename(origFilename) { 
	makeDirectory("output/" + outputFilePath );

	return "output/" + outputFilePath + "/" + origFilename.replaceAll("/", "#",) + ".md";
}


function paddingZero(num, digit) {
	if (digit > 9) return "" + num;
	if (digit <= 0) return "" + num;

	var padded = "000000000" + num ;
	return padded.substring(padded.length - digit, padded.length);
}

function isMultiLine(str) {
	var lines = str.split("\n");
	return (lines.length > 1);
}

function convLf2Crlf(str) {
	var retText = "";
	var lines = str.split("\n");
	for (var i=0; i<lines.length; i++) {
		retText = retText + lines[i] + "\r\n";
	}
	return retText;
}

function indentText(nestLv) {
	var retText = "";
	for (var i=0; i < nestLv; i++) {
		retText = retText + "\t";
	}
	return retText;
}

function getLinkText(orig) {
	return orig.toLowerCase();
}


function makeDirectory(path) {
	fs.mkdir(path, { recursive: true }, (err) => {
		if (err) throw err;
	});
}

