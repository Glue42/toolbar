import { glueAppsObs, startApp } from './glue-related.js';
import {
  favoriteApps,
  addFavoriteApp,
  removeFavoriteApp,
} from './favorites.js';
import { getSetting, getSettings } from './settings.js';
// import { clearSearch, getAppIcon } from './utils.js';
import { getAppIcon } from './utils.js';
import { changeFolderState, isFolderOpened } from './folders.js';

const searchInputObs = new rxjs.BehaviorSubject('');

let {
  filter: rxFilter,
  map: rxMap,
  distinctUntilChanged: rxDistinctUntilChanged,
  combineLatest: rxCombineLatest,
} = rxjs.operators;

const allApplicationsObs = glueAppsObs
  .pipe(rxFilter((apps) => apps.length > 0))
  .pipe(
    rxDistinctUntilChanged(undefined, (apps) => {
      // console.log(apps);
      // distinct apps have changed by creating an unique "hash" containing all the info that differentiate an app

      return (
        apps
          .map(
            (app) =>
              app.title +
              JSON.stringify(app.userProperties.appManagerOrder || '') +
              JSON.stringify(app.userProperties.consumes || '') +
              JSON.stringify(app.userProperties.folder || '') +
              app.instances.join()
          )
          .join() + JSON.stringify(getSettings())
      );
    })
  )
  .pipe(rxMap((allApps) => allApps.filter((app) => shouldAppBeVisible(app))))
  .pipe(rxMap((apps) => apps.sort(orderApps)))
  .pipe(
    rxMap((apps) => {
      const duplicatedApps = [];

      apps.forEach((app) => {
        if (
          app.userProperties.folder &&
          Array.isArray(app.userProperties.folder)
        ) {
          app.userProperties.folder.forEach((singleFolder) => {
            let appCopy = JSON.parse(JSON.stringify(app));

            appCopy.userProperties.folder = singleFolder;
            duplicatedApps.push(appCopy);
          });
        } else {
          duplicatedApps.push(app);
        }
      });

      return duplicatedApps;
    })
  );

const runningApps = allApplicationsObs.pipe(
  rxMap((apps) => {
    return apps
      .filter((app) => app.instances.length > 0)
      .filter(
        (app) => app.name !== glue.appManager.myInstance.application.name
      );
  })
);

function shouldAppBeVisible(app) {
  let shouldBeVisible = true;

  if (
    !getSetting('showHiddenApps') &&
    (app.hidden || app.name === glue42gd.applicationName)
  ) {
    shouldBeVisible = false;
  }

  return shouldBeVisible;
}

function orderApps(a, b) {
  let aOrder = a.userProperties.appManagerOrder;
  let bOrder = b.userProperties.appManagerOrder;

  if (typeof aOrder === 'number' && typeof bOrder !== 'number') {
    return -1;
  } else if (typeof aOrder !== 'number' && typeof bOrder !== 'number') {
    return 1;
  } else if (
    typeof aOrder === 'number' &&
    typeof bOrder === 'number' &&
    aOrder !== bOrder
  ) {
    return aOrder - bOrder;
  } else {
    const aTitleOrName = typeof a.title === 'undefined' ? a.name : a.title;
    const bTitleOrName = typeof b.title === 'undefined' ? b.name : a.title;

    return aTitleOrName.localeCompare(bTitleOrName);
  }
}

function handleAppClick() {
  q('#search-results').addEventListener('click', (e) => {
    let appName = e.path.reduce((name, el) => {
      return el.getAttribute && el.getAttribute('app-name')
        ? el.getAttribute('app-name')
        : name;
    }, '');

    if (e.target.matches('.add-favorite, .add-favorite *')) {
      let isAppFavorite = favoriteApps.value.includes(appName);

      if (isAppFavorite) {
        removeFavoriteApp(appName);
      } else {
        addFavoriteApp(appName);
      }
    } else if (e.target.matches('[app-name], [app-name] *')) {
      startApp(appName);
      // if (!e.ctrlKey) {
      //   clearSearch();
      // }
    } else if (e.target.matches('[folder-name], [folder-name] *')) {
      let folderElement = e.path.find((e) => e.getAttribute('folder-name'));
      let folderName = folderElement.getAttribute('folder-name');
      let isFolderOpen = folderElement.classList.contains('folder-open');

      changeFolderState(folderName, !isFolderOpen);
    }
  });
}

function handleSearchChange() {
  q('#app-search').addEventListener('keyup', (event) => {
    searchInputObs.next(event.target.value);
  });
}

function getItemHTMLTemplate(item, options) {
  if (item.type === 'folder') {
    return applicationFolderHTMLTemplate(item, options);
  } else if (item.type === 'app') {
    return applicationHTMLTemplate(item.item, options);
  }
}

function applicationFolderHTMLTemplate(folder, options) {
  // console.log(folder);
  let folderName = folder.item;
  let folderContents = '';
  let isFolderOpen = options.hasSearch || isFolderOpened(folderName);

  folder.children
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      } else {
        return 0;
      }
    })
    .forEach((child) => {
      folderContents += getItemHTMLTemplate(child, options);
    });

  let folderHeight = 48 + folder.children.length * 48;

  return `<li class="nav-item folder ${
    isFolderOpen ? 'folder-open' : ''
  }" folder-name="${folderName}" >
          <div class="nav-link action-menu">
            <span class="icon-size-16">
              <i class="icon-folder-empty" draggable="false"></i>
              <i class="icon-folder-open-empty" draggable="false"></i>
            </span>

            <span class="title-folder">${folderName}</span>
            <div class="action-menu-tool">
              <span class="icon-size-16">
                <i class="icon-angle-down"></i>
              </span>
            </div>
          </div>
          <ul class="flex-column nav folder-content">
          ${folderContents}
          </ul>
        </li>`;
}

function applicationHTMLTemplate(app, options = {}) {
  let { favoriteBtn } = options;

  return (
    `
    <li class="nav-item ${
      app.instances.length > 0 ? 'app-active' : ''
    }"" app-name="${app.name}" tabindex="${1}">
      <div class="nav-link action-menu">
        ${getAppIcon(app)}
        ${
          app.instances.length > 0
            ? '<!--<span class="icon-size-24 active-app text-success"><i class="icon-dot mr-2 "></i></span>-->'
            : ''
        }
        <span class="title-app">${app.title || app.name}</span>` +
    (favoriteBtn
      ? `
        <div class="action-menu-tool">
          <button class="btn btn-icon secondary add-favorite">
          <i class="icon-star-empty-1" draggable="false"></i>
          <i class="icon-star-full" draggable="false"></i>
          </button>
        </div>`
      : '') +
    `</div>
    </li>`
  );
}

function favoriteApplicationHTMLTemplate(app) {
  if (!app) {
    return '';
  }

  const displayName = typeof app.title === 'string' ? app.title : app.name;

  return `
  <li class="nav-item ${
    app.instances.length > 0 ? 'app-active' : ''
  }" app-name="${app.name}">
    <a class="nav-link" href="#" draggable="false" title="${displayName}">
      ${getAppIcon(app)}
      <span class="text-animation">${displayName}</span>
    </a>
  </li>
  `;
}

const noApplicationsHTML = `<li class="text-center pt-3">No applications</li>`;
const noRunningAppsHTML = `<li class="text-center pt-3">No running applications</li><li class="text-center pt-3"><button class="btn btn-secondary" menu-button-id="apps">Start application</button></li>`;
const noFavoriteAppsHTML = `<li class="text-center pt-3">No favorite apps</li>`;

export {
  // applicationsObs,
  searchInputObs,
  allApplicationsObs,
  getItemHTMLTemplate,
  applicationHTMLTemplate,
  applicationFolderHTMLTemplate,
  favoriteApplicationHTMLTemplate,
  handleAppClick,
  handleSearchChange,
  runningApps,
  noApplicationsHTML,
  noRunningAppsHTML,
  noFavoriteAppsHTML,
};
