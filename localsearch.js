let all = []
chrome.bookmarks.search({}, res => {
  for (let item of res) {
    if (item.url > '') {
      all.push(item)
    }
  }
  all.sort((a, b) => b.dateAdded - a.dateAdded)
  
})

const leftMark = '<<';//'&ldquo;'
const rightMark = '>>';//'&rdquo;'
const lenQuote = rightMark.length;

function annotationToArray(annotations) {
  if (!annotations)
    return [];
  if (annotations.trim().length === 0)
    return [];
  var chuncks = annotations.split(rightMark);
  var highlights = [];
  for (var i = 0; i < chuncks.length; i++) {
    var j = chuncks[i].indexOf(leftMark);
    if (j >= 0) {
      var comment = chuncks[i].substring(0, j).trim();
      var highlight = chuncks[i].substring(j + lenQuote);
      var k = highlight.lastIndexOf('@');
      var occurence = 0;
      var couleur = 'yellow';
      var pagenumber = null;
      if (k > 0) {
        try {
          var string = highlight.substring(k + 1);
          var c = highlight.indexOf('#', k);
          if (c != -1) {
            var trail = highlight.substring(k + 1, c);
            var chk = trail.split(',');
            //occurence = parseInt(highlight.substring(k+1,c));
            occurence = parseInt(chk[0]);
            if (chk.length === 2)
              pagenumber = parseInt(chk[1]);
            couleur = highlight.substring(c + 1);
          }
          else {
            //occurence = parseInt(highlight.substring(k+1));
            var trail = highlight.substring(k + 1);
            var chk = trail.split(',');
            occurence = parseInt(chk[0]);
            if (chk.length === 2)
              pagenumber = parseInt(chk[1]);
          }
          highlight = highlight.substring(0, k);
        } catch (eint) { occurence = 0; }
      }
      else {
        var c = highlight.lastIndexOf('#');
        if (c > 0) {
          couleur = highlight.substring(c + 1);
          highlight = highlight.substring(0, c);
        }
      }
      highlight = highlight.trim();//_TrimString(highlight);
      var obj = { p: pagenumber, selection: highlight, n: occurence, color: couleur, comment: comment };
      highlights.push(obj);
    }
  }
  return highlights;
}

function domain(url) {
  return new URL(url).hostname
}

function bold(text, query) {
  if (query > '')
    return text.replaceAll(query, '<b>' + query + '</b>')
  else
    return text;
}
function search(q) {
  let res = []

  for (let item of all) {
    if (item.url.indexOf(q) !== -1 || item.title.indexOf(q) !== -1)
      res.push(item)
  }
  results.innerHTML = null;
  for (let i =0 ;i<res.length ;i++) {
    let item = res[i];
    // hit.classList.add('card');
    let chunks = item.title.split('#__#');
    let title = chunks[0];
    let date = new Date(item.dateAdded).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    let highlights = annotationToArray(chunks[1]);
    let html = [];
    for (let h of highlights) {
      if (h.selection.indexOf(q) !== -1)
        html.push(`<span class="highlight  text-2xl ">${bold(h.selection, q)}</span>`);
      else
        html.push(`<span class="highlight">${h.selection}</span>`);
    }
    html = html.join('...');  
    console.log(html.length);

    console.log(html);

    let content = `
          <div class="flex flex-col  w-1/2 rounded-lg text-white ">  
            <div class="title px-4 py-2 border-b text-2xl bg-red-700 rounded-lg ">
              <a href="${item.url}" class="text-white hover:underline">${bold(title, q)}</a>
            </div>
            <div class="text-black  bg-gray-300 rounded-lg ">
            ${html}
            </div>
            <div class="domain px-4 py-2 text-gray-500">
              <a href="${item.url}" class="text-black hover:underline">${domain(item.url)}</a> - ${date}
            </div>

          </div>


`;   

    if(html.length>0) results.innerHTML += content;
  }



  
}

/*document.getElementById('close').addEventListener('click',(evt) => {
  evt.preventDefault()
  evt.stopPropagation()
  window.close();
})*/

document.getElementById('form').onsubmit = (evt) => {
  evt.preventDefault()
  evt.stopPropagation()
  if (query.value.trim() > '')
    search(query.value.trim().toLowerCase());
}
