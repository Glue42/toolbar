import {
  allApplicationsObs,
  searchInputObs,
  applicationHTMLTemplate,
  favoriteApplicationHTMLTemplate,
  handleAppClick,
  handleSearchChange,
  runningApps,
  noRunningAppsHTML,
  noApplicationsHTML,
  noFavoriteAppsHTML,
  applicationFolderHTMLTemplate,
  getItemHTMLTemplate,
} from './applications.js';
import { favoriteApps, updateFavoriteApps } from './favorites.js';
import {
  filteredLayouts,
  layoutHTMLTemplate,
  handleLayoutClick,
  handleLayoutSave,
  noLayoutsHTML,
} from './layouts.js';
import * as glueModule from './glue-related.js';
import * as utils from './utils.js';
import { handleWidthChange, handleDropDownClicks } from './visible-area.js';
import { gssPromise } from './gss.js';
import {
  clientHTMLTemplate,
  searchClients,
  searchInstruments,
  instrumentHTMLTemplate,
  handleClientAndInstrumentClicks,
} from './clients-and-instrument-search.js';
import { getSetting } from './settings.js';
import { populateSID } from './profile.js';

let {
  map: rxMap,
  combineLatest: rxCombineLatest,
  distinctUntilChanged: rxDistinctUntilChanged,
} = rxjs.operators;

let refreshAppsObs = new rxjs.BehaviorSubject(true);

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  await glueModule.getPrefs();

  console.log('window loaded');
  printApps();
  printRunningApps();
  printLayouts();
  printFavoriteApps();
  printNotificationCount();
  printNotificationButton();
  printInitialToastState();

  handleWidthChange();
  handleAppClick();
  handleSearchChange();
  handleLayoutClick();
  handleLayoutSave();

  handleDropDownClicks();
  handleClientAndInstrumentClicks();

  utils.handleClicks();
  utils.startTutorial();
  glueModule.registerHotkey();
  glueModule.focusWindow(utils.focusInputAfterWindowRecover);

  populateSID();
  showFeedbackPanel();
  showProfilePanel();
}

function printApps() {
  searchInputObs
    .pipe(rxCombineLatest(allApplicationsObs))
    .pipe(
      rxMap(([searchInput, apps]) => {
        let search = searchInput.toLowerCase().trim();

        return {
          search,
          filteredApps: apps.filter(
            (app) => (app.title || app.name).toLowerCase().indexOf(search) >= 0
          ),
        };
      })
    )
    .pipe(rxCombineLatest(refreshAppsObs.asObservable()))
    .subscribe(async ([{ search, filteredApps: apps }, refresh]) => {
      let newResultsHTML = '';

      if (search.trim().length > 1) {
        if (getSetting('searchClients')) {
          let clientsSearch = await searchClients(search);

          clientsSearch.entities.forEach((client) => {
            newResultsHTML += clientHTMLTemplate(client);
          });
        }

        if (getSetting('searchInstruments')) {
          let instrumentSearch = await searchInstruments(search);

          instrumentSearch.entities.forEach((instrument) => {
            newResultsHTML += instrumentHTMLTemplate(instrument);
          });
        }
      }

      newResultsHTML += buildAppHTML(apps, {
        favoriteBtn: true,
        hasSearch: search.trim().length > 1,
      });

      // apps.forEach(app => newResultsHTML += applicationHTMLTemplate(app, {favoriteBtn: true}));
      q('#search-results').innerHTML = newResultsHTML || noApplicationsHTML;
      updateFavoriteApps();
    });
}

function refreshApps() {
  refreshAppsObs.next();
}

function buildAppHTML(apps, options) {
  let structuredItems = buildFolderStructure(apps);
  let html = '';

  structuredItems
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : b.type === 'folder' ? 1 : 0;
      }

      return 0;
    })
    .forEach((item) => {
      html += getItemHTMLTemplate(item, options);
    });

  return html;
}

function buildFolderStructure(apps) {
  let results = [];

  apps.forEach((app) => {
    let appFolder = app.userProperties.folder || '';
    let appFolderSplit = appFolder.split('/').filter((f) => f);
    let currentFolder = [];

    appFolderSplit.forEach((folder) => {
      currentFolder.push(folder);
      createFolder(currentFolder, results);
    });

    insertInFolder(appFolderSplit, app, results);
  });

  return results;
}

function createFolder(folderPath, root) {
  if (folderPath.length < 1) {
    return;
  }

  let nextFolderName = folderPath[0];
  let folderExists = root.find(
    (item) => item.type === 'folder' && item.item === nextFolderName
  );

  if (!folderExists) {
    root.push({ type: 'folder', item: nextFolderName, children: [] });
  }

  createFolder(
    folderPath.slice(1),
    root.find((item) => item.type === 'folder' && item.item === nextFolderName)
      .children
  );
}

function insertInFolder(appFolder, app, results) {
  let currentFolder = results;

  appFolder = appFolder || [];
  appFolder.forEach((folder) => {
    currentFolder = currentFolder.find(
      (item) => item.type === 'folder' && item.item === folder
    );

    if (currentFolder) {
      currentFolder = currentFolder.children;
    }
  });

  currentFolder.push({ type: 'app', item: app });
}

function printRunningApps() {
  runningApps.subscribe((runningApps) => {
    let newRunningAppsHTML = '';

    if (runningApps.length > 0) {
      runningApps.forEach(
        (runningApp) =>
          (newRunningAppsHTML += applicationHTMLTemplate(runningApp, {
            favoriteBtn: false,
          }))
      );
      q('#running-apps').innerHTML = newRunningAppsHTML;
    } else {
      q('#running-apps').innerHTML = noRunningAppsHTML;
    }
  });
}

function printLayouts() {
  filteredLayouts.subscribe((layouts) => {
    let newLayoutsHTML = '';
    // console.log(layouts);

    if (layouts.length > 0) {
      layouts.forEach(
        (layout) => (newLayoutsHTML += layoutHTMLTemplate(layout))
      );
      q('#layout-load>ul').innerHTML = newLayoutsHTML;
    } else {
      q('#layout-load>ul').innerHTML = noLayoutsHTML;
    }
  });
}

function printFavoriteApps() {
  favoriteApps
    .pipe(rxjs.operators.combineLatest(allApplicationsObs))
    .subscribe(([favApps, allApps]) => {
      let favAppsHtml = ``;
      let existingFavApps = favApps.filter((favApp) =>
        allApps.find((a) => a.name === favApp)
      );

      if (existingFavApps.length > 0) {
        existingFavApps.forEach((favApp) => {
          let fullApp = allApps.find((a) => a.name === favApp);

          if (fullApp) {
            favAppsHtml += favoriteApplicationHTMLTemplate(fullApp, {
              favoriteBtn: false,
            });
          }
        });
      } else {
        favAppsHtml = noFavoriteAppsHTML;
      }

      q('#fav-apps').innerHTML = favAppsHtml;
    });
}

function printNotificationCount() {
  glueModule.notificationsCountObs.subscribe((count) => {
    if (count !== null) {
      q('#notifications-count').innerHTML = count;

      if (count === 0) {
        q('#notifications-count').classList.add('empty');
      } else {
        q('#notifications-count').classList.remove('empty');
      }
    }
  });
}

function printNotificationButton() {
  const notificationsEnabled = getSetting('enableNotifications');
  const notificationButton = q('#notification-panel');

  if (!notificationsEnabled) {
    notificationButton.classList.add('d-none');
  }
}

function printInitialToastState() {
  const notificationsEnabled = getSetting('enableNotifications');
  const enableToasts = q('#enable-toasts');

  if (!notificationsEnabled) {
    enableToasts.checked = false;
    enableToasts.disabled = true;
  }
}

async function showFeedbackPanel() {
  const userProperties = await glueModule.getUserProperties();
  const hideFeedback = userProperties.hideFeedbackButton;

  if (!hideFeedback) {
    q('#feedback-panel').classList.remove('d-none');
  }
}

async function showProfilePanel() {
  const userProperties = await glueModule.getUserProperties();
  const hideProfile = userProperties.hideProfileButton;

  if (hideProfile === true) {
    q('#profile-panel').classList.add('d-none');
  }
}

export { refreshApps };
