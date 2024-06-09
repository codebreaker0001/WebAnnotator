var signedin = false;
var highlightswrapper = document.querySelector('#text_highlightswrapper');
var forecolor = "#000000";
var currentColor = "yellow";
var hoverColor = 'lightgray';//'pink'
var hoverElement = null;
var lastHighlight = null;
var leftMark = '<<';//'&ldquo;'
var rightMark = '>>';//'&rdquo;'
var lenquote = rightMark.length;//2;
var googleColors = [];
googleColors['yellow'] = '#FFFF66';
googleColors['blue'] = '#0df';
googleColors['red'] = '#ff9999';
googleColors['green'] = '#99ff99';
googleColors['white'] = 'transparent';
var notRemapped = [];



function contentScriptRequestCallback(request, sender, sendResponse) {
  if (request.action)
  {
    if (request.action === 'signedin')
    {
      if (!signedin)
      {
        signedin = true; // this avoids loops: we declare we're signed first
        if (highlightswrapper)
        {

          highlightswrapper.style.display = 'block';
        }
      }
    }
    else if (request.action === 'text_next_highlight')
      text_next_highlight();
    else if (request.action === 'text_chrome')
      text_chrome(request.color);
    else if (request.action === 'text_delete_highlight')
      text_delete_highlight();
    else if (request.action === 'text_copytoclipboard')
      text_copytoclipboard(request.payload);
  }
  if (sendResponse)
  {
    //console.log('sending response to background page');
    sendResponse({reponse:'ok'});
  }
  return true; // important in case we need sendResponse asynchronously
}

function text_copytoclipboard(html) {

  if(typeof ClipboardItem === "undefined") {
    alert("Sorry! ClipboardItem not available in your browser.")
    return;
  }
  
  const type = "text/html";
  const blob = new Blob([html], {type});
  const data = [new ClipboardItem({[type]: blob})];

  navigator.clipboard.write(data).then(function () {
    alert('text highlights copied to your clipboard!')
  }, function (e) {
    alert('error copying to clipboard')
  });
}
chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(contentScriptRequestCallback);
});

let charactersUsed = 0;
function setCharactersLeft(txt)
{
  charactersUsed = txt;
  if (highlightswrapper && highlightswrapper.querySelector('#charactersleft'))
    highlightswrapper.querySelector('#charactersleft').textContent = txt + '/2048 chars';

}


function showNotFound(evt)
{
  if (highlightsnotfoundtext.style.display === 'none')
  {
    var html = [];
    notRemapped.forEach(highlight => html.push(highlight.selection));
    highlightsnotfoundtext.innerHTML = `<div style='text-align:left;color:white'>${html.join('<br>')}</div>`;
    highlightsnotfoundtext.style.display = 'block';
  }
  else
    highlightsnotfoundtext.style.display = 'none';
}

function setHighlightsNotFound(array)
{
  if (highlightswrapper && highlightswrapper.querySelector('#highlightsnotfound'))
  {
    if (array.length > 0)
    {
      highlightswrapper.querySelector('#highlightsnotfound').textContent = array.length + ' missing';
    }
    else
      highlightswrapper.querySelector('#highlightsnotfound').textContent = '';
  }
}


function purifyURL(href)
{
    if (href && href.indexOf('https://mail.google') === 0)
      return href;
    var url = href;
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
    //console.log('purifyURL=',href,'=',url);
    return url;
}

function text_getGoodUrl(doc)//,url)
{
    var url = null;
    if (doc && doc.location && doc.location.hostname.indexOf('readability.com') !== -1)
    {
        var origin = doc.querySelector('.entry-origin a');
        if (origin)
            url = origin.href;
    }
    if (!url)
        url = doc.location.href;

    if (url.indexOf("q=cache:") > 0)
    {
        try {
            return purifyURL(doc.getElementsByTagName('base')[0].href);
        } catch (e) {}
    }
    else
        return purifyURL(url);
}

function needSignIn()
{
  signedin = false;
  if (highlightswrapper)
  {
    highlightswrapper.style.display = 'block';
  }
}

function askForAnnotations(delay)
{
  var url = text_getGoodUrl(document);
  var additionalInfo = {
    "fn": "text_getAnnotations",
    "title": document.title,
    "url": url
  };
  if (!delay)
    delay = 0;
  setTimeout(function () {
    sendMessage(additionalInfo, function (res) {
      if (res && res.error)
      {
        if (res.signedout)
        {
          needSignIn();
        }
      }
      else if (res && res.noannotation)
      {
        signedin = true;
        hoverElement = null;
        
      }
      else if (res && res.annotations)
      {
        signedin = true;
        hoverElement = null;
        setCharactersLeft(computeLength(res.annotations));
        text_remapAnnotations(res.annotations);
        
      }
    });
  }, delay);
}

function text_signin()
{
    var width = 400;
    var height = 360;
    var left = Math.floor( (screen.width - width) / 2);
    var top = Math.floor( (screen.height - height) / 2);
    window.open('https://www.google.com/accounts/ServiceLogin?service=toolbar&nui=1&hl=en&continue=http%3A%2F%2Ftoolbar.google.com%2Fcommand%3Fclose_browser','bkmk_popup','left='+left+',top='+top+',height='+height+'px,width='+width+'px,resizable=1');
}
function text_undohighlight()
{
  if (lastHighlight !== null)
  {
    var f = document.createDocumentFragment();
    while(lastHighlight.firstChild)
      f.appendChild(lastHighlight.firstChild);
    lastHighlight.parentNode.replaceChild(f,lastHighlight);
    lastHighlight = null;
  }
}

function addHighlightsWrapper()
{
  if (highlightswrapper === null)
  {
    highlightswrapper = document.createElement('div');
    highlightswrapper.id = 'text_highlightswrapper';
    highlightswrapper.style.userSelect = 'none';
    highlightswrapper.style.display = 'none';
    highlightswrapper.style.position = 'fixed';
    highlightswrapper.style.zIndex = 200000;
    highlightswrapper.style.margin = '0px';
    highlightswrapper.style.userSelect = 'none';
    highlightswrapper.style.fontFamily = '"avenir next",Helvetica';
    highlightswrapper.style.right = '8px';
    highlightswrapper.style.bottom = '8px';
    highlightswrapper.style.borderRadius = '8px';
    highlightswrapper.style.boxShadow = '0 0 2px black';
    highlightswrapper.style.color = 'white';
    highlightswrapper.textContent = '';
    highlightswrapper.style.textAlign = 'center';
    //highlightswrapper.style.cursor = 'pointer';

    highlightswrapper.style.fontSize = '14px';
    highlightswrapper.style.fontWeight = 'bold';
    highlightswrapper.style.color = 'white';//'black';
    highlightswrapper.style.backgroundColor = '#190B33';//'#8a8';
    //highlightswrapper.style.borderRadius = '32px';
    highlightswrapper.style.padding = '8px 16px';
    //highlightswrapper.textContent = '';
    var highlightsnotfound = document.createElement('div');
    highlightsnotfound.style.color = '#a22';
    highlightsnotfound.style.cursor = 'pointer';
    highlightsnotfound.addEventListener('click',showNotFound);
    highlightsnotfound.title = 'Click to show missing highlights';
    highlightsnotfound.id = 'highlightsnotfound';
    highlightswrapper.appendChild(highlightsnotfound);

    var highlightsnotfoundtext = document.createElement('div');
    highlightsnotfoundtext.style.color = '#a22';
    highlightsnotfoundtext.style.display = 'none';
    highlightsnotfoundtext.id = 'highlightsnotfoundtext';
    highlightswrapper.appendChild(highlightsnotfoundtext);
    let close = document.createElement('div');
    close.textContent = '✕';
    close.style.position = 'absolute';
    close.style.top = 0;
    close.style.left = 0;
    close.style.margin = '4px';
    close.style.fontSize = '12px'
    close.style.padding = '4px';
    close.style.color = '#ccc';
    close.style.cursor = 'pointer'
    close.addEventListener('click',function() { highlightswrapper.style.display ='none'},false);
    highlightswrapper.appendChild(close);
    document.body.appendChild(highlightswrapper);
  }
}

function text_storeHighlight(webUrl,title,highlight,occurence,couleur,addcommentwhendone)
{
    var additionalInfo = {
        "fn": "addhighlight",
        "title": title,
        "url": webUrl,
        "selection": highlight,
        "occurence": occurence,
        "couleur": couleur
    };
    sendMessage(additionalInfo, function (res)
    {
      if (res && res.addedhighlight)
      {
        signedin = true;
        setCharactersLeft(res.pureLen);

        if (addcommentwhendone)
        {
          hoverElement = lastHighlight;
          recolor('note');
        }
      }
      if (res && res.toobig)
      {
        text_undohighlight();
        alert('Too many characters (>2048 even compacted)!');
      }
      if (res && res.undohighlight || res.error)
      {
        if (res.signedout)
          alert('text cannot store your highlight because you are signed out.\nPlease signin first and then refresh this page');
        text_undohighlight();
      }
    });
}

function text_tryHighlight(wnd,addcommentwhendone)
{
    if (!wnd)
      return false;
    var nselections = wnd.getSelection().rangeCount;
    if (nselections === 0)
        return false;
    var selection = wnd.getSelection().getRangeAt(0);
    var selectionstring = wnd.getSelection()+"";//selection.toString();
    selectionstring = selectionstring.trim();
    if (selectionstring.length === 0)
        return false;
    if (selectionstring.indexOf("\n") >= 0)
    {
        alert("Please select text without new lines");
        return false;
    }
    var docurl = text_getGoodUrl(wnd.document);
    var occurence = -1;
    wnd.getSelection().removeAllRanges();
    var found = false;
    while (!found && wnd.find(selectionstring,true,false))
    {
        occurence += 1;
        var rng = wnd.getSelection().getRangeAt(0);
        if (selection.compareBoundaryPoints(Range.END_TO_START, rng) == -1 && selection.compareBoundaryPoints(Range.START_TO_END, rng) == 1)
            found = true;
    }
    if (!found)
        occurence = -1;
    if (occurence >= 0)
    {
        lastHighlight = highlightNowFirefox22(wnd.getSelection().getRangeAt(0),currentColor,forecolor,wnd.document,selectionstring,occurence);
        wnd.getSelection().removeAllRanges();
        text_storeHighlight(docurl,wnd.document.title,selectionstring,occurence,currentColor,addcommentwhendone);
        return true;
    }
    else
    {
        alert('Sorry, [' + selectionstring + '] was not found.');
        wnd.getSelection().removeAllRanges();
        return false;
    }
}

function getWindowWithSelection(wnd)
{
    //alert('hasSelection:' + wnd);
    if (wnd.getSelection().rangeCount>0)
    {
        //alert('found selection:' + wnd.getSelection());
        return wnd;
    }
    else
        return null;
}

function recolor(color)
{
  if (color === 'note')
  {
    let caption = hoverElement.dataset.comment!==null?hoverElement.dataset.comment:'';
    let newcomment = prompt('Enter note',caption);
    if (newcomment !== null)
    {
      newcomment = newcomment.trim();
      if (newcomment.length === 0)
      {

        delete hoverElement.dataset.comment;
        delete hoverElement.title;
      }
      else
      {
        hoverElement.dataset.comment = newcomment;
        hoverElement.title = newcomment;
      }
      updateHighlight(hoverElement,color,newcomment);
      hoverElement = null;
    }
    return;
  }
  else
  {
    hoverElement.dataset.textColor = googleColors[color];
    hoverElement.style.backgroundColor = googleColors[color];
    childrenToo(hoverElement,googleColors[color]);
    updateHighlight(hoverElement,color,null);
    window.getSelection().removeAllRanges();
  }
}
function rangeIntersectsNode(range, node) {
    var nodeRange;
    if (range.intersectsNode) {
        return range.intersectsNode(node);
    } else {
        nodeRange = node.ownerDocument.createRange();
        try {
            nodeRange.selectNode(node);
        } catch (e) {
            nodeRange.selectNodeContents(node);
        }

        return range.compareBoundaryPoints(Range.END_TO_START, nodeRange) == -1 &&
        range.compareBoundaryPoints(Range.START_TO_END, nodeRange) == 1;
    }
}

function sendMessage(info,cb)
{
  try {
    chrome.runtime.sendMessage(info, function response(res) {
      if (res && cb)
        cb(res);
    });
  } catch(e)
  {
    if (cb)
      cb({error:e});
    else
      console.error('sendMessage error' + e);
  }
}

function text_chrome(color)
{
    if (color === 'email')
    {
        var info = {
            "title": document.title,
            "url": window.location.href,
            "fn": "emailhighlights",
        };
        sendMessage(info);
        return;
    }
    if (color === 'copytoclipboard')
    {
        var info = {
            "title": document.title,
            "url": window.location.href,
            "fn": "copytoclipboard",
        };
        sendMessage(info);
        return;
    }

    if (color && color !== 'note')
    {
        currentColor = color;
    }
    else
    {
        //currentColor = 'yellow';
    }

    var elem = hoverElementOrSelection();
    if (elem)
    {
      hoverElement = elem;
      recolor(color);
    }
    else
    {
      var wndWithSelection = getWindowWithSelection(window);
      if (color === 'note')
        text_tryHighlight(wndWithSelection,true);
      else
        text_tryHighlight(wndWithSelection);
    }
}

function text_remapAnnotations(highlights)
{
  return highlightDoc(window,document,highlights);
}

function text_uncompact(wnd,highlights)
{
	for (var i=0;i<highlights.length;i++)
	{
		//console.log(i,highlights[i].selection,highlights[i].n)
		var sel = highlights[i].selection;
		var chk = sel.split('~~');
		if (chk.length === 2 && chk[1].length === 16)
		{
			wnd.getSelection().removeAllRanges();
			var len = parseInt(chk[0]);
			var first = chk[1].substring(0,8);
			var second = chk[1].substring(8,16);
			//console.log(len,first,second);
			if (wnd.find(first,true,false))
			{
				var s = wnd.getSelection();
				//console.log('found',first);
				var anchor = s.anchorNode;
				var offsetstart = s.anchorOffset;
				//console.log('offset1=',offsetstart);
				if (wnd.find(second,true,false))
				{
					//console.log('found second',second);
					s = wnd.getSelection();
					if (anchor === s.focusNode){
						var offsetend = s.focusOffset; // end of match
						if (offsetend - offsetstart === len)
						{
							var content = s.anchorNode.textContent.replace(/\s/g,' ');
							highlights[i].selection_unpacted = content.substring(offsetstart,offsetend);
						}

					}
					else{
						var offsetend = s.focusOffset + anchor.textContent.length;
						if (offsetend - offsetstart === len)
						{
							var content = anchor.textContent.replace(/\s/g,' ') + s.focusNode.textContent.replace(/\s/g,' ');
							highlights[i].selection_unpacted = content.substring(offsetstart,offsetend);
						}
					}
				}
			}
			else
			{
			}
		}
	}
}

function highlightDoc(wnd,doc,highlights)
{
    let previousRange = null;
    if (wnd.getSelection().rangeCount > 0)
      previousRange = wnd.getSelection().getRangeAt(0);
    var scrollLeft = wnd.scrollX;
    var scrollTop = wnd.scrollY;
    nremapped = 0;
    notRemapped = [];
    text_uncompact(wnd,highlights);
    for (var i=0;i<highlights.length;i++)
    {
        wnd.getSelection().removeAllRanges();
        var selectionString = highlights[i].selection;
        if (highlights[i].selection_unpacted)
        	selectionString = highlights[i].selection_unpacted;
        var n = 0;
        while (n<highlights[i].n && wnd.find(selectionString,true,false))
        {
            n++;
        }
        if (n == highlights[i].n && wnd.find(selectionString,true,false))
        {
          try {
            highlightNowFirefox22(wnd.getSelection().getRangeAt(0), highlights[i].color, forecolor, doc, highlights[i].selection, highlights[i].n,highlights[i].comment);
            nremapped++;
          }
          catch(e){
            console.error('error highlightNowFirefox22',e);
          }
        }
        else
          notRemapped.push(highlights[i]);
    }
    wnd.getSelection().removeAllRanges();
    wnd.scrollTo(scrollLeft,scrollTop);
    if (previousRange)
      wnd.getSelection().addRange(previousRange);
    return nremapped;
}
function highlightNowFirefox22(selectionrng,color,textcolor,doc, selectionstring,occurence,comment)
{
    let baseNode = doc.createElement("text");//span was changing styling on some web pages
    baseNode.className = 'text-highlight';
    baseNode.style.backgroundColor = googleColors[color];
    if (comment && comment > '')
    {
      baseNode.dataset.comment = comment;
      baseNode.title = comment;
    }
    baseNode.dataset.selection = selectionstring;
    baseNode.dataset.textOccurence = occurence;
    baseNode.dataset.textColor = googleColors[color];

    let node = text_highlight222(selectionrng, baseNode, googleColors[color]);

    node.addEventListener('mouseover',function (e) {
      hoverElement = this;
    },false);

    node.addEventListener('mouseout',function (e) {
      hoverElement = null;
    },false);

    return node;
}
window.oncontextmenu = function () {
  if (hoverElement !== null)
  {
    let selection = window.getSelection();
    if (selection.rangeCount > 0) {
      selection.removeAllRanges();
    }
    let range = document.createRange();
    range.selectNode(hoverElement);
    selection.addRange(range);
  }
}

function childrenToo(docfrag,backgroundColor)
{
    docfrag.childNodes.forEach(f => {if (f.style){f.style.backgroundColor = backgroundColor}});
}

function text_highlight222(range, node,backgroundColor)
{
    var startContainer = range.startContainer;
    var startOffset = range.startOffset;
    var endOffset = range.endOffset;
    var docfrag = range.extractContents();
    childrenToo(docfrag,backgroundColor);
    var before = startContainer.splitText(startOffset);
    var parent = before.parentNode;
    node.appendChild(docfrag);
    parent.insertBefore(node, before);
      node.style.color = 'black'
    return node;
}

function updateHighlight(elt,color,newcomment)
{
    if (elt)
    {
        sendMessage({action: "recolor_highlight", url: text_getGoodUrl(document), title: document.title, highlightString: hoverElement.dataset.selection, n:hoverElement.dataset.textOccurence, newcolor: color, comment:newcomment}, function (res){
          if (res && res.error)
          {
            //console.error(res);
            text_undohighlight();
            if (res.toobig)
              alert('Too many characters (>2048 even compacted)!');
          }
          else
          {
            if (res && res.highlights)
              setCharactersLeft(computeLength(res.highlights));
          }
        });
    }
}

function hoverElementOrSelection() {
  if (hoverElement !== null)
    return hoverElement;
  var wndWithSelection = getWindowWithSelection(window);
  if (!wndWithSelection)
    return null;
  let rng = wndWithSelection.getSelection().getRangeAt(0);
  let elems = document.querySelectorAll('.text-highlight');

  for (let i=0;i<elems.length;i++)
  {
    if (rangeIntersectsNode(rng,elems[i].firstChild))
      return elems[i];
  }
  return null;
}

function computeLength(highlights)
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
    return annotation.length;
}

function text_delete_highlight() {
  let elem = hoverElementOrSelection();
  if (elem)
  {
    sendMessage({action: "delete_highlight", url: text_getGoodUrl(document), title: document.title, highlightString: elem.dataset.selection, n:elem.dataset.textOccurence }, function (res)
    {
      if (res && res.highlights)
        setCharactersLeft(computeLength(res.highlights));
    });
    childrenToo(elem,null);
    var f = document.createDocumentFragment();
    while(elem.firstChild)
        f.appendChild(elem.firstChild);
    elem.parentNode.replaceChild(f,elem);
    hoverElement = null;

  }
}

var currentHighlight = 0;

function addStyle(doc,css)
{
  var style = document.createElement('style');
  style.innerHTML = css;
  doc.head.appendChild(style);
}

function text_next_highlight(evt)
{
  // prevent text selection
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }
  if (!signedin)
    return text_signin();

  var highlights = document.getElementsByClassName('text-highlight');
  if (highlights.length==0)
      return;
  currentHighlight = currentHighlight % highlights.length;

  let h = highlights[currentHighlight];
  h.style.transition = 'opacity 0.3s ease-in-out';
  h.scrollIntoView({behavior: "smooth", block: "end", inline: "nearest"});
  h.style.opacity = 0.2;
  currentHighlight += 1;
  setTimeout(function () { h.style.opacity=1.0; }, 300);
}
window.onhashchange = function (evt) {
  askForAnnotations(2000);
};

if (document.location.hostname === 'toolbar.google.com' && document.location.pathname === '/command' && document.location.search && document.location.search.indexOf('close_browser') !== -1)
{
    window.close();
    sendMessage({fn: "text_toolbar_signed_in"});
}

else
{
    if (window.top !== window)
    {
    }
    else{       
       addHighlightsWrapper();
        addStyle(window.document,'.text-highlight:hover{opacity:0.6;}.text-highlight[data-comment]{border-bottom:1px dashed black}');
        askForAnnotations(2000);
    }

    
}