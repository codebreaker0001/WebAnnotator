

let searchButton = document.getElementById('searchChromeBookmarks');
searchButton.addEventListener('click', () => {
  chrome.tabs.create({url:chrome.runtime.getURL('localsearch.html')})
  window.close()
});

chrome.runtime.onMessage.addListener(async function requestCallback(request, sender, sendResponse) {
  if (request.msg === 'importMessage') {
    if (request.error) {
      importmessage.textContent = request.error
      importButton.textContent = 'Import'
      importButton.disabled = false
    }
    else {
      importmessage.textContent = `imported ${request.n} bookmarks`;
      request.start ? importButton.disabled = true : importButton.disabled = false
    }
  }
});

