var urls = {};
var cachedAnnotations = {};
var cachedLabels = {};
var leftMark = '<<';//'&ldquo;'
var rightMark = '>>';//'&rdquo;'
var lenQuote = rightMark.length;
var saveChromeBookmarks = true;
var googleSignature = null;

var textBookmarkId = null;

chrome.bookmarks.search({title:'text'}, res => {
  if (res.length > 0) {
    textBookmarkId = res[0].id;
    console.log('textBookmarkId=',textBookmarkId)
  }
  else {
    chrome.bookmarks.create({title:'text'}, newfolder => {
      textBookmarkId = newfolder.id;
      console.log('textBookmarkId=',textBookmarkId)
    })
  }
})

function getFolderName(url,dateString) {
  let res = 'unknown'
    res = new Date(dateString).getFullYear() + '-' + String((new Date(dateString).getMonth()+1)).padStart(2,'0')
  //else {
    try {
      res = new URL(url).hostname.replace('www.','')
    } catch (e) {
    }
  //}
  return res
}

async function remove(id) {
  if (!id)
    return
  return new Promise((resolve,reject) => {
    chrome.bookmarks.remove(id,res => resolve(res))
  })
}

async function search(obj) {
  return new Promise((resolve,reject) => {
    chrome.bookmarks.search(obj,res => resolve(res))
  })
}

function subtree(res) {
  let result = []
  if (res.url > '')
    result.push(res)
  if (res.children) {
    for (let c of res.children) {
      result = result.concat(subtree(c))
    }
  }
  return result
}

async function gettextBookmarks() {
  return new Promise((resolve,reject) => {
    console.log(textBookmarkId)
    chrome.bookmarks.getSubTree(textBookmarkId, res => {
      resolve(subtree(res[0]))
    })
  })
}


async function create(obj) {
  return new Promise((resolve,reject) => {
    chrome.bookmarks.create(obj,res => resolve(res))
  })
}

async function folderExists(name,parentId) {
  parentId = parentId ? parentId : textBookmarkId
  let res = await search({title:name})
  return res.find(f => f.parentId === parentId)
}

async function createFolder(year,month) {
  let yearFolder = await folderExists(year)
  if (!yearFolder)
    yearFolder = await create({title:year,parentId: textBookmarkId})
  let monthFolder = await folderExists(month,yearFolder.id)
  if (!monthFolder)
    monthFolder = await create({title:month,parentId: yearFolder.id})
  return monthFolder
}

async function createBookmark(obj,date) {
  let year = ''+date.getFullYear()
  let month = date.toLocaleDateString('en-US',{month:'long'})
  let folder = await createFolder(year,month)
  //console.log(year,month,folder)
  await create({title:obj.title,url:obj.url,parentId: folder.id})
}

chrome.runtime.onMessage.addListener(requestCallback);

chrome.storage.sync.get({
    saveChromeBookmarks: true,
  }, function(items) {
    if (items)
    {
      saveChromeBookmarks = items.saveChromeBookmarks;
    }
  });

chrome.storage.onChanged.addListener(function(changes, namespace) {
  for (key in changes)
  {
    var storageChange = changes[key];

    if (key === 'saveChromeBookmarks'){
      saveChromeBookmarks = storageChange.newValue;
    }

  }
});

text_setStatusIcon("off");






var abortTimerId = null;
var requestTimeout = 1000 * 5;  // 5 seconds

function text_getElement(xml, elementname)
{
    var e = xml.getElementsByTagName(elementname);
    if (e.length == 0)
        e = xml.getElementsByTagName('smh:' + elementname);
    if (e==null)
        console.log('text_getElement null for: ' + elementname);
    return e;
}


async function text_getAnnotations_chrome_bookmarks(webUrl,cb)
{
  let url = purifyURL(webUrl);
  let result = await search({url:url})
  //console.log(result)
  let annotations = '';
  let labels = '';
  result.forEach((item, i) => {
    let chunks = item.title.split('#__#');
    if (chunks.length > 1) {
      annotations += chunks[1];
    }
  });
  if (annotations.length > 0) {
    text_remapAnnotations(webUrl,annotations,labels,cb);
  }
}

function text_getAnnotations_chrome_storage(webUrl,cb) {
  var keyName = purifyURL(webUrl).hashCode();
  var obj = {};
  obj[keyName] = null;
  chrome.storage.sync.get(obj,function(items) {
    if (items && items[keyName])
    {
      text_remapAnnotations(webUrl,items[keyName].annotations,items[keyName].labels,cb);
    }
  });
}

async function text_getAnnotations(webUrl,cb){
    if (saveChromeBookmarks)
      return await text_getAnnotations_chrome_bookmarks(webUrl,cb);
}

function text_setStatusIcon(s)
{
    chrome.action.setIcon({path:"redW.png"});

}

function sendMessageActiveTab(json)
{
  chrome.tabs.query({active:true,currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0)
    {
      var tab = tabs[0];
      const port = chrome.tabs.connect(tab.id);
      port.onDisconnect = function (err) { console.error('disconnected',err)};

      port.postMessage(json);
    }
  });
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'text'+hash;
};

function text_remapAnnotations(url, annotations, labels,cb)
{
    if (annotations === null || annotations === undefined)
    {
      return cb({error:'annotations===null'});
    }
    var url = purifyURL(url);
    cachedAnnotations[url] = annotations;
    cachedLabels[url] = labels;
    var highlights = annotationToArray(annotations);
    chrome.action.setBadgeText({'text':''+highlights.length});
    chrome.action.setTitle({title:'text'});
    urls[url] = highlights.length;
    cb({annotations:highlights});
}

function formatAnnotation(text){
    var newtext = text.replace(/&ldquo;/gi,leftMark).replace(/&rdquo;/gi,rightMark);

    return newtext;
}

function text_compact(webAnnotation)
{
    var highlights = annotationToArray(webAnnotation);
    for (var i=0;i<highlights.length;i++)
    {
    	var sel = highlights[i].selection;
    	if (sel.indexOf('~~') !== -1) // already compacted
    		continue;
    	var len = sel.length;
    	if (len >= 16)
    	{
    		sel = len + '~~' + sel.substring(0,8) + sel.substring(len-8);
        highlights[i].selection = sel;
      }
    }
    return arrayToAnnotation(highlights)
}

function text_storeHighlight(webUrl,title,highlight,occurence,couleur,pagenumber,cb)
{
    var qurl = purifyURL(webUrl);

    // new version uses cache and google signature
    var webAnnotation = cachedAnnotations[qurl];
    var webLabels = cachedLabels[qurl];
    if (!webAnnotation)
    {
        //console.error('no webannotation cached for',webUrl,qurl);
        webAnnotation = '';
    }
    if (!webLabels)
        webLabels = '';
    webAnnotation = formatAnnotation(webAnnotation);
    if (occurence === 0)
    {
        if (pagenumber)
            webAnnotation += leftMark + highlight + "@" + occurence + ',' + pagenumber;
        else
            webAnnotation += leftMark + highlight;
    }
    else
    {
        webAnnotation += leftMark + highlight + "@" + occurence;
        if (pagenumber)
            webAnnotation += ',' + pagenumber;
    }
    if (couleur != 'yellow')
        webAnnotation += '#' + couleur;
    webAnnotation += rightMark + " ";
    let pureLen = webAnnotation.length;
    if (!saveChromeBookmarks && webAnnotation.length > 2048)
    {
    	console.log('too long so compacting annotations',qurl,webAnnotation.length);
    	var compacted = text_compact(webAnnotation);
    	if (compacted.length > 2048)
    	{
    	  text_setStatusIcon('error');
      	return cb({toobig:true});
      }
      else
      {
      	console.log('compacted format len=',compacted.length);
      	webAnnotation = compacted;
      }
    }
    text_storeHighlightsNow(qurl, title, webLabels, webAnnotation, googleSignature, function (res){
     if (res.ok)
     {
      text_setStatusIcon('on');
       var nannotations = webAnnotation.split(rightMark).length-1;
       chrome.action.setBadgeText({'text':''+nannotations});
       chrome.action.setTitle({title:'text'});
       urls[qurl] = nannotations;
       cachedAnnotations[qurl] = webAnnotation;
       return cb({addedhighlight:true,pureLen:pureLen});
     }
     else
     {
        text_setStatusIcon('error');
        return cb(res);
     }
   });
}

async function text_storeHighlightsNow(webUrl, title, labels, annotations, gooSignature, callback)
{
    
    if (saveChromeBookmarks)
    {
      let url = purifyURL(webUrl)
      let obj = {url: url, title: title + '#__#' + annotations};
      var folderName = new Date().toLocaleDateString('en-US',{year:'numeric',month:'short'})
      //console.log('obj=',obj);
      let result = await search({url:url})
      if (result && result.length > 0)
      {
        console.log('updating bookmark')
        chrome.bookmarks.update(result[0].id,obj);
      } else {
        console.log('creating bookmark')
        createBookmark(obj,new Date())
      }
      callback({ok:true});
      return;
    }
}

function refreshBrowserAction(url)
{
    var qurl = purifyURL(url);
    if (urls[qurl] != undefined)
    {
        chrome.action.setBadgeText({'text':''+urls[qurl]});
    }
    else
        chrome.action.setBadgeText({'text':'0'});
    chrome.action.setTitle({title:'text'});
}

function copyTextToClipboard(text) {
  sendMessageActiveTab({action:'text_copytoclipboard',payload: text})
}

let googleColors = [];
googleColors['yellow'] = '#FFFF66';
googleColors['blue'] = '#0df';
googleColors['red'] = '#ff9999';
googleColors['green'] = '#99ff99';
googleColors['white'] = 'transparent';

function text_copyclipboard(url,title, html = true)
{
    url = purifyURL(url);
    if (title.trim().length == 0)
        title = 'no title';
    var webAnnotation = cachedAnnotations[url];
    var highlights = annotationToArray(webAnnotation);
    if (html) {
      var body = '<a href="' + url + '">' + title + '</a><br>';
      for (var i=0;i<highlights.length;i++)
      {
        body += '<span style="background-color:' + googleColors[highlights[i].color] + '">' + highlights[i].selection + '</span><br>'
      }
      body += '<br>'
      copyTextToClipboard(body);

    } else {
      var body = title + '\n' + url + '\n';
      for (var i=0;i<highlights.length;i++)
      {
        if (highlights[i].comment)
          body += highlights[i].comment + ' ';
        body += '<<' + highlights[i].selection + '>>\n';
      }
      copyTextToClipboard(body);
    }
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (tab && tab.url)
    refreshBrowserAction(tab.url);
});

function arrayToAnnotation(highlights)
{
    var annotation = '';
    for (var i=0;i<highlights.length;i++)
    {
      if (highlights[i].comment)
        annotation += highlights[i].comment;
      annotation += leftMark + highlights[i].selection;
      if (highlights[i].p)
        annotation += '@' + highlights[i].n + ',' + highlights[i].p;
      else if (highlights[i].n > 0)
          annotation += '@' + highlights[i].n;
      if (highlights[i].color != 'yellow')
          annotation += '#' + highlights[i].color;
      annotation += rightMark + ' ';
    }
    return annotation;
}

function annotationToArray(annotations)
{
    if (!(annotations > ''))
      return [];
    if (annotations.trim().length === 0)
      return [];
    var chuncks = annotations.split(rightMark);
    var highlights = [];
    for (var i=0;i<chuncks.length;i++)
    {
        var j = chuncks[i].indexOf(leftMark);
        if (j>=0)
        {
            var comment = chuncks[i].substring(0,j).trim();
            var highlight = chuncks[i].substring(j+lenQuote);
            var k = highlight.lastIndexOf('@');
            var occurence = 0;
            var couleur = 'yellow';
            var pagenumber = null;
            if (k > 0)
            {
                try {
                    var string = highlight.substring(k+1);
                    var c = highlight.indexOf('#',k);
                    if (c != -1)
                    {
                        var trail = highlight.substring(k+1,c);
                        var chk = trail.split(',');
                        occurence = parseInt(chk[0]);
                        if (chk.length===2)
                            pagenumber = parseInt(chk[1]);
                        couleur = highlight.substring(c+1);
                    }
                    else
                    {
                        var trail = highlight.substring(k+1);
                        var chk = trail.split(',');
                        occurence = parseInt(chk[0]);
                        if (chk.length===2)
                            pagenumber = parseInt(chk[1]);
                    }
                    highlight = highlight.substring(0,k);
                } catch (eint) { occurence = 0; }
            }
            else
            {
                var c = highlight.lastIndexOf('#');
                if (c>0)
                {
                    couleur = highlight.substring(c+1);
                    highlight = highlight.substring(0,c);
                }
            }
            highlight = highlight.trim();
            var obj = {p:pagenumber,selection:highlight,n:occurence,color:couleur,comment:comment};
            highlights.push(obj);
        }
    }
    return highlights;
}


function requestCallback(request, sender, sendResponse)
{
  var tabURL = purifyURL(request.url);
  var tabTitle = request.title;
  if (request.fn === 'text_getAnnotations')
  {
    text_getAnnotations(request.url,function(res){
      signedin = !res.error;
      sendResponse(res);
    });
  }
  else if (request.fn === 'text_toolbar_signed_in')
  {
    signedin = true;
    sendResponse({});
  }
  else if (request.fn === 'addhighlight')
  {
     text_storeHighlight(request.url,request.title,request.selection,request.occurence,request.couleur,null,function (res){
      signedin = !res.error;
      sendResponse(res);
     });
  }
  else if (request.fn === 'addhighlightpdf')
  {
    text_storeHighlight(request.url,request.title,request.selection,request.occurence,request.couleur,request.p,function(res){
      sendResponse(res);
    });
  }
  else if (request.fn === 'copytoclipboard')
  {
    text_copyclipboard(request.url,request.title);
    sendResponse({});
  }
  else if (request.action == 'delete_highlight')
    delHighlightNow(request.highlightString,request.n,tabURL,tabTitle,null,function (res){
      sendResponse(res);
    });
  
  else if (request.action == 'recolor_highlight')
    updateHighlight(request.highlightString,request.n,request.newcolor,request.comment,tabURL,tabTitle,null,function(res){
      sendResponse(res);
    });
  

  // important: we want to use sendResponse asynchronously sometimes (e.g. fetching annotations using XHR)
  return true;

}

function updateHighlight(fragment, occurence, newcolor, comment, url, title,pagenumber,cb)
{
    var qurl = url;
    var j = qurl.lastIndexOf('/index.htm');
    if (j == -1)
        j = qurl.lastIndexOf('/index.html');
    if (j != -1)
        qurl = qurl.substring(0,j+1);
    webAnnotation = cachedAnnotations[qurl];
    if (!webAnnotation)
    {
        return cb({error:'no annotation found'});
    }

    var highlights = annotationToArray(webAnnotation);
    var idx = -1;
    for (var i=0;i<highlights.length;i++)
    {
        if (highlights[i].selection == fragment && highlights[i].n == occurence)
        {
            if (idx != -1)
            {
                return cb({error:'found in more than one highlight'});
            }
            else
                idx = i;
        }
    }
    if (idx == -1)
    {
        return cb({error:'Highlight not found'});
    }
    else
    {
      if (newcolor === 'note')
        highlights[idx].comment = comment;
      else
        highlights[idx].color = newcolor;
      webAnnotation = arrayToAnnotation(highlights);
      var webLabels = cachedLabels[qurl];
      if (!webLabels)
          webLabels = '';
      if (!saveChromeBookmarks && webAnnotation.length > 2048)
        return cb({error:'too long',toobig:true});
      text_storeHighlightsNow(url, title, webLabels, webAnnotation, googleSignature, function (res){
        if (res.ok)
        {
          cachedAnnotations[qurl] = webAnnotation;

          cb({highlights:highlights});
        }
        else
          cb(res);
      });
    }

}

function delHighlightNow(fragment,occurence,url,title,pagenumber,cb)
{
    var qurl = purifyURL(url);
    webAnnotation = cachedAnnotations[qurl];
    if (!webAnnotation)
    {
        return cb({error:'no annotation found'});
    }

    var highlights = annotationToArray(webAnnotation);
    var idx = -1;
    for (var i=0;i<highlights.length;i++)
    {
        var same = highlights[i].selection == fragment;
        if (same && highlights[i].n == occurence)
        {
            if (idx != -1)
            {
                console.log('[' + fragment + '] found in more than one highlight, please select more text to identify which highlight to delete');
                return cb({error:'found in more than one highlight'});
            }
            else
                idx = i;
        }
    }
    if (idx == -1)
    {
        console.log('delHighlightNow error: Highlight not found [' + fragment + ']');
        return cb({error:'not found'});
    }
    else
    {

        highlights.splice(idx,1);
        webAnnotation = arrayToAnnotation(highlights);
        //alert(webAnnotation);
        var webLabels = cachedLabels[qurl];
        if (!webLabels)
            webLabels = '';
        if (urls[qurl])
        {
            urls[qurl] -= 1;
            refreshBrowserAction(qurl);
        }
        text_storeHighlightsNow(url, title, webLabels, webAnnotation, googleSignature, function(res){
          if (res.ok)
          {
            cachedAnnotations[qurl] = webAnnotation;
            cb({highlights:highlights});
          }
          else
            cb(res);
         });
    }
}


function isPDF(href)
{
    if (href.indexOf('pdf_viewer.html') === -1)
        return href;
    let comps = href.split('?file=');
    if (comps.length > 1)
        return decodeURIComponent(comps[1])
    else
        return href;
}



chrome.contextMenus.onClicked.addListener((info,tab) => {
  if (info.menuItemId === 'delete')
    sendMessageActiveTab({action:'text_delete_highlight'})
  else if (info.menuItemId === 'copyclipboard') {
    let url = isPDF(tab.url);
    let title = tab.title;
    text_copyclipboard(url,title);
  } else if (info.menuItemId === 'search')
    chrome.tabs.create({url:chrome.runtime.getURL('localsearch.html')});
  else if (info.menuItemId === 'edit') {
    let possiblePDFUrl = isPDF(info.pageUrl);
    chrome.tabs.create({url:chrome.runtime.getURL('localedit.html?url=' + encodeURIComponent(purifyURL(possiblePDFUrl)))});
  } else {
    let color = info.menuItemId;
    sendMessageActiveTab({action:'text_chrome',color:color,url:info.pageUrl});
  }
})

chrome.contextMenus.create({
  "id" : "yellow",
  "title" : "Yellow",// (Ctrl-Shift-Y)",
  "type" : "normal",
  "contexts" : ["selection"],
});
chrome.contextMenus.create({
  "id" : "red",
  "title" : "Red",// (Ctrl-Shift-R)",
  "type" : "normal",
  "contexts" : ["selection"],
});
chrome.contextMenus.create({
  "id" : "blue",
  "title" : "Blue",// (Ctrl-Shift-B)",
  "type" : "normal",
  "contexts" : ["selection"],
});
chrome.contextMenus.create({
  "id" : "green",
  "title" : "Green",// (Ctrl-Shift-G)",
  "type" : "normal",
  "contexts" : ["selection"],
});

chrome.contextMenus.create({
  "id" : "note",
  "title" : "Comment",// (Ctrl-Shift-C)",
  "type" : "normal",
  "contexts" : ["selection"],
});

chrome.contextMenus.create({
  "id" : "delete",
  "title" : "Delete",// (Ctrl-Shift-D)",
  "type" : "normal",
  "contexts" : ["selection"],
});

chrome.contextMenus.create({
  "id" : "copyclipboard",
  "title" : "Copy",
  "type" : "normal",
  "contexts" : ["page"],
});

chrome.contextMenus.create({
  "id" : "search",
  "title" : "Search",
  "type" : "normal",
  "contexts" : ["page"],
});

chrome.contextMenus.create({
  "id" : "edit",
  "title" : "Edit",
  "type" : "normal",
  "contexts" : ["page"],
});

chrome.commands.onCommand.addListener(function(command) {
  if (command === 'text-yellow')
    sendMessageActiveTab({action:'text_chrome',color:'yellow'});
  else if (command === 'text-red')
    sendMessageActiveTab({action:'text_chrome',color:'red'});
  else if (command === 'text-blue')
    sendMessageActiveTab({action:'text_chrome',color:'blue'});
  else if (command === 'text-green')
    sendMessageActiveTab({action:'text_chrome',color:'green'});
  else if (command === 'text-delete')
    sendMessageActiveTab({action:'text_delete_highlight'});
  else if (command === 'text-note')
    sendMessageActiveTab({action:'text_chrome',color:'note'});
});

function purifyURL(href)
{
  if (href && href.indexOf('https://mail.google') === 0)
    return href;

  try {
    var url = stripMobilizer(href);
    var pos = url.indexOf('#');
    if (pos > 0)
        url = url.substring(0,pos);
    url = url.replace(/[?&]utm_.*/,'');
    url = url.replace(/[?&]WT\..*/,'');
    url = url.replace(/[?&]ns_.*/,'');
    url = url.replace(/[?&]rand=.*/,'');
    url = url.replace(/[?&]src=.*/,'');
    url = url.replace(/[?&]imm_mid=.*/,'');
    url = url.replace(/[?&]cmp=.*/,'');
    url = url.replace(/[?&]ncid=.*/,'');
    url = url.replace(/[?&]cps=.*/,'');
    url = url.replace(/[?&]mc_cid=.*/,'');
    url = url.replace(/[?&]mc_eid=.*/,'');
    url = url.replace(/[?&]mbid=.*/,'');
    if (url.indexOf('nytimes.com')!=-1)
        url = url.split('?')[0];
    return url;
  } catch (eurl) { return href; }
}
