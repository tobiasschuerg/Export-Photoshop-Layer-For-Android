/**
 * Export for Android Photoshop Script 1.4
 *
 * See the contributors file for a changelog and contributors.
 *
 * This script is intended to be used on a photoshop document containing mdpi
 * artwork for Android. It will resize, trim and save the selected layer or group, into a
 * directory you select using the layer name (normalised) for the file name. There are a
 * couple of resizing options you can select such as the
 * resizing method and whether to scale styles or not. It does not alter your original
 * document in anyway.
 *
 * Images are saved to 'drawable-mdpi', 'drawable-hdpi', 'drawable-xhdpi',
 * 'drawable-xxhdpi', and 'drawable-xxxhdpi'
 * directories under the selected output directory. If these directories do not exist, 
 * the script will create them.
 *
 * Original 'license':
 * Feel free to share/reuse/modify to your heart's content.
 * Attribution would be nice but is not required.
 */
// constants
var ResizeMethod = {
    AUTO: {name: 'Automatic', value: 'automatic'},
    NEARESTNEIGHBOUR: {name: 'Nearest Neighbour', value: 'Nrst'},
    BILINEAR: {name: 'Bilinear', value: 'Blnr'},
    BICUBIC: {name: 'Bicubic', value: 'Bcbc'},
    BICUBICSMOOTHER: {name: 'Bicubic Smoother', value: 'bicubicSmoother'},
    BICUBICSHARPER: {name: 'Bicubic Sharper', value: 'bicubicSharper'}
};
var resizeMethodLookup = {};
resizeMethodLookup[ResizeMethod.AUTO.name] = ResizeMethod.AUTO.value;
resizeMethodLookup[ResizeMethod.NEARESTNEIGHBOUR.name] = ResizeMethod.NEARESTNEIGHBOUR.value;
resizeMethodLookup[ResizeMethod.BILINEAR.name] = ResizeMethod.BILINEAR.value;
resizeMethodLookup[ResizeMethod.BICUBIC.name] = ResizeMethod.BICUBIC.value;
resizeMethodLookup[ResizeMethod.BICUBICSMOOTHER.name] = ResizeMethod.BICUBICSMOOTHER.value;
resizeMethodLookup[ResizeMethod.BICUBICSHARPER.name] = ResizeMethod.BICUBICSHARPER.value;

var OriginalDensity = {
    MDPI: {name: 'MDPI', value: 1}, // ~ 160dpi
    HDPI: {name: 'HDPI', value: 1.5}, // ~ 240dpi
    XHDPI: {name: 'XHDPI', value: 2}, // ~ 320dpi
    XXHDPI: {name: 'XXHDPI', value: 3}, // ~ 480dpi
    XXXHDPI: {name: 'XXXHDPI', value: 4} // ~ 640dpi -> 4K
};

var origalDensityLookup = {};
origalDensityLookup[OriginalDensity.MDPI.name] = OriginalDensity.MDPI.value;
origalDensityLookup[OriginalDensity.HDPI.name] = OriginalDensity.HDPI.value;
origalDensityLookup[OriginalDensity.XHDPI.name] = OriginalDensity.XHDPI.value;
origalDensityLookup[OriginalDensity.XXHDPI.name] = OriginalDensity.XXHDPI.value;
origalDensityLookup[OriginalDensity.XXXHDPI.name] = OriginalDensity.XXXHDPI.value;

var exportDialog;


function savePng(width, resizeMethod, scaleStyles, folderName, normalisedName, dupDoc)
{
    resizeImage(UnitValue(width, "px"), resizeMethod, scaleStyles);
    outputFolder = Folder(folderName);
    if(!outputFolder.exists) outputFolder.create();
    saveForWebPNG(dupDoc, outputFolder.fullName, normalisedName);
}

function saveForWebPNG(doc, outputFolderStr, filename)
{
    var opts, file;
    opts = new ExportOptionsSaveForWeb();
    opts.format = SaveDocumentType.PNG;
    opts.PNG8 = false;
    opts.quality = 100;
    if (filename.length > 27) {
        file = new File(outputFolderStr + "/temp.png");
        doc.exportDocument(file, ExportType.SAVEFORWEB, opts);
        file.rename(filename + ".png");
    }
    else {
        file = new File(outputFolderStr + "/" + filename + ".png");
        doc.exportDocument(file, ExportType.SAVEFORWEB, opts);
    }
}

function resizeImage(width, method, scaleStyles)
{
    var action = new ActionDescriptor();
    action.putUnitDouble( charIDToTypeID("Wdth"), charIDToTypeID("#Pxl"), width );

    if(scaleStyles == true)
        action.putBoolean( stringIDToTypeID("scaleStyles"), true );

    action.putBoolean( charIDToTypeID("CnsP"), true );
    if(method != ResizeMethod.AUTO.value) {
         action.putEnumerated( charIDToTypeID("Intr"), charIDToTypeID("Intp"), charIDToTypeID(method) );
    }
    executeAction( charIDToTypeID("ImgS"), action, DialogModes.NO );
}

function exportAllLayers(folder, resizeMethod, scaleStyles, originalDensity, trimWhiteSpace, initialResolution)
{
    var doc = app.activeDocument;
    for(var a=0;a<doc.layers.length;a++)
    {
        exportImages(doc.layers[a], doc.layers[a].name, folder, resizeMethod, scaleStyles, originalDensity, trimWhiteSpace, initialResolution);
    }
}

function exportSingleLayer(baseName, folder, resizeMethod, scaleStyles, originalDensity, trimWhiteSpace, initialResolution)
{
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    exportImages(layer, baseName, folder, resizeMethod, scaleStyles, originalDensity, trimWhiteSpace, initialResolution);
}

function exportImages(layer, baseName, folder, resizeMethod, scaleStyles, originalDensity, trimWhiteSpace, initialResolution)
{
    // get currect document
    var doc = app.activeDocument;

    // create new document based on the current docs values except name which user
    var dup = app.documents.add(doc.width, doc.height, doc.resolution, baseName, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);

    // switch back to original doc to allow duplicate
    app.activeDocument = doc;

    // duplicate the selected layer (only works for one) at place it in the new doc
    layer.duplicate(dup);

    // switch back to the new document
    app.activeDocument = dup;

    // trim the document so that all that appears is our element
    if (trimWhiteSpace)
    {
        dup.trim(TrimType.TRANSPARENT);
    }

	// adjust canvas size so that it is an even number of pixels (so scaling down fits on whole pixel)
	dup.resizeCanvas(Math.ceil(dup.width/2)*2, Math.ceil(dup.height/2)*2, AnchorPosition.TOPLEFT);
	
	// normalise name (basic normalisation lower case and hyphenated, modify or remove to taste)
	var normalisedName = dup.name.toLowerCase().replace(' ', '-');

    var originalWidth;
    if (dup.width > initialResolution) {
        originalWidth = initialResolution;
    } else {
        originalWidth = dup.width;
    }

	var mdpiWidth = originalWidth * ( OriginalDensity.MDPI.value / originalDensity);
	var hdpiWidth = originalWidth *  ( OriginalDensity.HDPI.value / originalDensity);
	var xhdpiWidth = originalWidth *  ( OriginalDensity.XHDPI.value / originalDensity);
	var xxhdpiWidth = originalWidth *  ( OriginalDensity.XXHDPI.value / originalDensity);
	var xxxhdpiWidth = originalWidth *  ( OriginalDensity.XXXHDPI.value / originalDensity);

	savePng(mdpiWidth,  resizeMethod, scaleStyles, folder.fullName + '/drawable-mdpi',  normalisedName, dup);
	savePng(hdpiWidth,  resizeMethod, scaleStyles, folder.fullName + '/drawable-hdpi',  normalisedName, dup);
	savePng(xhdpiWidth, resizeMethod, scaleStyles, folder.fullName + '/drawable-xhdpi', normalisedName, dup);
	savePng(xxhdpiWidth, resizeMethod, scaleStyles, folder.fullName + '/drawable-xxhdpi', normalisedName, dup);
	savePng(xxxhdpiWidth, resizeMethod, scaleStyles, folder.fullName + '/drawable-xxxhdpi', normalisedName, dup);

    dup.close(SaveOptions.DONOTSAVECHANGES);
}

function okClickedHandler()
{
    var resizeMethod = resizeMethodLookup[exportDialog.methodOptions.selection.text];
    var scaleStyles = exportDialog.scaleStylesCheckBox.value;
    var baseName = exportDialog.namePanel.nameBox.text;
    var originalDensity = origalDensityLookup[exportDialog.originalDensityOptions.selection.text];
    var trimWhiteSpace = exportDialog.trimWhiteSpaceCheckBox.value;
    var initialResolution = exportDialog.resolution.text;
    exportDialog.close();

    // select a folder to save to
    var folder = Folder.selectDialog();
    if (folder)
    {
        // Save original units
        var originalRulerUnits = app.preferences.rulerUnits ;
        var originalTypeUnits = app.preferences.typeUnits ;

        app.preferences.rulerUnits=Units.PIXELS;
        app.preferences.typeUnits=TypeUnits.PIXELS;

        if (exportDialog.allLayersCheckBox.value == true) {
            exportAllLayers(folder, resizeMethod, scaleStyles, originalDensity, trimWhiteSpace, initialResolution);
        }
        else {
            exportSingleLayer(baseName, folder, resizeMethod, scaleStyles, originalDensity, trimWhiteSpace, initialResolution);
        }

        app.preferences.rulerUnits=originalRulerUnits;
        app.preferences.typeUnits=originalTypeUnits;
    }
}

exportDialog = new Window('dialog', 'Export Selected Layer for Android');
exportDialog.alignChildren = 'left';

exportDialog.namePanel = exportDialog.add('panel', undefined, 'Base name');
exportDialog.namePanel.alignChildren = 'left';

var doc = app.activeDocument;
var defaultName = doc.activeLayer.name;

exportDialog.namePanel.nameBox = exportDialog.namePanel.add('edittext', undefined, 'Name');
exportDialog.namePanel.nameBox.preferredSize = [160,20];
exportDialog.namePanel.nameBox.text = defaultName;

exportDialog.add('statictext', undefined, 'Resize method: ');
exportDialog.methodOptions = exportDialog.add('dropdownlist', undefined, [ResizeMethod.AUTO.name, ResizeMethod.NEARESTNEIGHBOUR.name, ResizeMethod.BILINEAR.name, ResizeMethod.BICUBIC.name, ResizeMethod.BICUBICSMOOTHER.name, ResizeMethod.BICUBICSHARPER.name]);
exportDialog.methodOptions.children[0].selected = true;

exportDialog.add('statictext', undefined, 'Base density: ');
exportDialog.originalDensityOptions = exportDialog.add('dropdownlist', undefined, [OriginalDensity.MDPI.name, OriginalDensity.HDPI.name, OriginalDensity.XHDPI.name, OriginalDensity.XXHDPI.name, OriginalDensity.XXXHDPI.name], 'den');
exportDialog.originalDensityOptions.children[2].selected = true;

exportDialog.add('statictext', undefined, 'With width (px): ');
exportDialog.resolution = exportDialog.add('edittext', undefined, '48', 'initialResolution');
// exportDialog.resolution.value = 128;

exportDialog.add('statictext', undefined, 'Export options: ');

exportDialog.scaleStylesCheckBox = exportDialog.add('checkbox', undefined, 'Scale Styles');
exportDialog.scaleStylesCheckBox.value = true;

exportDialog.allLayersCheckBox = exportDialog.add('checkbox', undefined, 'Export All Layers');
exportDialog.allLayersCheckBox.value = true;

exportDialog.trimWhiteSpaceCheckBox = exportDialog.add('checkbox', undefined, 'Trim Whitespace');
exportDialog.trimWhiteSpaceCheckBox.value = false;

exportDialog.buttonGroup = exportDialog.add('group');
exportDialog.buttonGroup.cancelButton = exportDialog.buttonGroup.add('button', undefined, 'Cancel');
exportDialog.buttonGroup.okButton = exportDialog.buttonGroup.add('button', undefined, 'OK');
exportDialog.buttonGroup.okButton.addEventListener('click', okClickedHandler);
exportDialog.show();
