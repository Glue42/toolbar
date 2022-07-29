import {
  shutdown,
  gluePromise,
  startApp,
  focusApp,
  getApp,
  themeObs,
  changeTheme,
  refreshApps,
  openNotificationPanel,
  glueVersion,
  getMonitorInfo,
  getWindowBounds,
  notificationEnabledObs,
  moveMyWindow,
  minimize,
  raiseNotification,
  isMinimizeAllowed,
  saveLayout,
  setDefaultGlobal,
  openFeedbackForm,
} from './glue-related.js';
import { updateSetting, getSetting } from './settings.js';
import { applyOpenClasses, getMonitor } from './visible-area.js';
import { searchInputObs } from './applications.js';
import {
  populateProfileData,
  profile_handleShutdownClick,
  profile_handleRestartClick,
  profile_handleFeedbackClick,
} from './profile.js';

const windowMargin = 50;
let isVertical;

let arrowKeysObs = rxjs
  .fromEvent(document, 'keydown')
  .pipe(
    rxjs.operators.filter((e) => {
      return e.key === 'ArrowUp' || e.key === 'ArrowDown';
    })
  )
  .pipe(rxjs.operators.map((e) => e.key.slice(5)))
  .subscribe(console.warn);

function handleClicks() {
  handleNotificationClick();
  handleEnableNotificationsClick();
  handleEnableToastsClick();
  handleFeedbackClick();
  handleOrientationChange();
  handleThemeChange();
  populateAboutPage();
  handleShutdownClick();
  handleTopMenuClicks();
  handleCloseDrawerClicks();
  handleMinimizeClick();
  handleMouseHover();
  handleModalClose();
  populateProfileData();
  profile_handleShutdownClick();
  profile_handleRestartClick();
  profile_handleFeedbackClick();
}

function handleThemeChange() {
  qa('.theme-select').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.target.matches('input.select_input[type="radio"]')) {
        let themeToSelect = e.target.getAttribute('theme-name');

        changeTheme(themeToSelect);
      }
    });
  });
  themeObs.subscribe((themeObj) => {
    if (themeObj) {
      themeObj.all.forEach((theme) => {
        q('html').classList.remove(theme.name);
      });

      q('html').classList.add(themeObj.selected.name);
      qa('.theme-select .select_options').forEach((item, i) => {
        let allThemesHtml = ``;

        themeObj.all.forEach((theme) => {
          allThemesHtml += `<li class="select_option">
          <input class="select_input" type="radio" name="theme" id="theme-${
            theme.name + i
          }" theme-name="${theme.name}" ${
            theme.name === themeObj.selected.name ? 'checked' : ''
          }/>
          <label class="select_label" for="theme-${theme.name + i}">${
            theme.displayName
          }</label></li>`;
        });
        item.innerHTML = allThemesHtml;
      });
    }
  });
}

async function handleOrientationChange() {
  isVertical = !!q('.view-port.vertical');
  q('#toggle .mode').innerHTML = isVertical ? 'horizontal' : 'vertical';

  if (getSetting('vertical') === false) {
    gluePromise.then(() => {
      q('#toggle').click();
    });
  }

  q('#toggle').addEventListener('click', async () => {
    await ensureWindowHasSpace(isVertical);
    q('.app').classList.add('switching-orientation');
    isVertical = !isVertical;
    updateSetting({ vertical: isVertical });
    q('#toggle .mode').innerHTML = isVertical ? 'horizontal' : 'vertical';
    q('.view-port').classList.add(isVertical ? 'vertical' : 'horizontal');
    q('.view-port').classList.remove(isVertical ? 'horizontal' : 'vertical');
    q('.app').classList.add(isVertical ? 'd-inline-flex' : 'h');
    q('.app').classList.remove(isVertical ? 'h' : 'd-inline-flex');
    qa('[column]').forEach((col) => {
      if (isVertical) {
        col.classList.add('flex-column');
      } else {
        col.classList.remove('flex-column');
      }
    });

    if (isVertical) {
      document.body.classList.remove('open-top');
    } else {
      document.body.classList.remove('open-left');
    }

    setTimeout(() => {
      q('.app').classList.remove('switching-orientation');
    });
  });
}

async function ensureWindowHasSpace(isVertical) {
  console.log('check near edge');

  let monitorInfo = await getMonitorInfo();
  let windowBounds = await getWindowBounds();
  let visibleAreaBounds = q('.view-port').getBoundingClientRect();
  let realBounds = {
    top: windowBounds.top + visibleAreaBounds.top,
    left: windowBounds.left + visibleAreaBounds.left,
    width: visibleAreaBounds.width,
    height: visibleAreaBounds.height,
  };
  let currentMonitor = getMonitor(realBounds, monitorInfo);

  if (isVertical) {
    // should have enough space on the right
    let newRight = windowBounds.left + visibleAreaBounds.right + 340 + 20;
    let monitorMostRight =
      currentMonitor.left + currentMonitor.workingAreaWidth;

    if (newRight > monitorMostRight) {
      moveMyWindow({
        left: windowBounds.left - (newRight - monitorMostRight),
      });
    }
  } else {
    // should have enough space below
    let newBottom = windowBounds.top + visibleAreaBounds.bottom + 350 + 20;
    let monitorMostBottom =
      currentMonitor.top + currentMonitor.workingAreaHeight;

    if (newBottom > monitorMostBottom) {
      moveMyWindow({
        top: windowBounds.top - (newBottom - monitorMostBottom),
      });
    }
  }
}

function populateAboutPage() {
  q('.gd-version').innerText = glue42gd.version;
  q('.gw-url').innerText = glue42gd.gwURL;
  q('.username').innerText = glue42gd.user;

  gluePromise.then(async (glue) => {
    q('.glue-js-version').innerText = await glueVersion();
  });
}

function handleShutdownClick() {
  q('#shutdown').addEventListener('click', () => {
    shutdown();
  });
}

function handleTopMenuClicks() {
  document.addEventListener('click', async (e) => {
    if (e.target.matches('a, a *') && e.ctrlKey) {
      e.preventDefault();
    }

    if (
      e.target.matches('[menu-button-id="apps"], [menu-button-id="apps"] *') &&
      e.altKey
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      updateSetting({ showHiddenApps: !getSetting('showHiddenApps') });
      refreshApps();
      return;
    }

    if (e.target.matches('[menu-button-id], [menu-button-id] *')) {
      //open selected drawer (apps, layouts)
      let topElement = e.path.find((e) => e.getAttribute('menu-button-id'));
      let menuId = topElement.getAttribute('menu-button-id');

      qa(`[menu-id]:not([menu-id="${menuId}"])`).forEach((menu) => {
        menu.classList.add('hide');
      });
      qa(`[menu-id]:not([menu-button-id="${menuId}"]) .chavron`).forEach(
        (menuBtnChavron) => {
          menuBtnChavron.classList.remove('chavron-rotate');
        }
      );

      let menuToToggle = q(`[menu-id="${menuId}"]`);

      if (menuToToggle.classList.contains('hide')) {
        await applyOpenClasses();
      }

      menuToToggle.addEventListener(
        'transitionend',
        focusMenuInputAfterTransition
      );
      menuToToggle.classList.toggle('hide');

      toggleTopButtonState(menuId);

      let hasVisibleDrawers = q('.toggle-content:not(.hide)');

      if (hasVisibleDrawers) {
        q('.app').classList.add('has-drawer');
      } else {
        q('.app').classList.remove('has-drawer');
      }
    } else if (e.target.matches('#fav-apps .nav-item, #fav-apps .nav-item *')) {
      //start or focus an app from the favorites list
      let topElement = e.path.find(
        (e) => e.classList && e.classList.contains('nav-item')
      );
      let appName = topElement.getAttribute('app-name');
      let isActive = topElement.classList.contains('app-active');

      startApp(appName);
    }
  });
}

function handleCloseDrawerClicks() {
  document.addEventListener('click', (e) => {
    if (e.target.matches('.close-drawer, .close-drawer *')) {
      let menu = e.path.find((e) => e && e.getAttribute('menu-id'));
      let menuId = menu && menu.getAttribute('menu-id');

      if (menuId) {
        q(`[menu-button-id="${menuId}"]`).click();
        // q('.expand').classList.remove('expand');
      }
    }
  });
}

function handleMinimizeClick() {
  document.addEventListener('click', (e) => {
    if (e.target.matches('.minimize, .minimize *')) {
      console.log('minimize');
      minimize();
    }
  });

  isMinimizeAllowed().then(
    (allowed) => allowed && q('.minimize').classList.remove('d-none')
  );
}

// TODO: Maybe use Chevron instead of Chavron?
function toggleTopButtonState(id) {
  qa(`[menu-button-id="${id}"] .chavron`).forEach((chavron) =>
    chavron.classList.toggle('chavron-rotate')
  );
  qa(`[menu-button-id="${id}"] > a`).forEach((chavron) =>
    chavron.classList.toggle('active')
  );
  qa(`[menu-button-id]:not([menu-button-id="${id}"]) .chavron`).forEach(
    (chavron) => chavron.classList.remove('chavron-rotate')
  );
  qa(`[menu-button-id]:not([menu-button-id="${id}"]) > a`).forEach((chavron) =>
    chavron.classList.remove('active')
  );
}

function focusMenuInputAfterTransition(e) {
  if (!e.propertyName || e.propertyName !== 'width') {
    return;
  }

  let menu = e.srcElement;

  menu.removeEventListener('transitionend', focusMenuInputAfterTransition);

  if (!menu.classList.contains('hide')) {
    let autofocusInput = menu.querySelector('input[autofocus]');

    if (autofocusInput) {
      autofocusInput.focus();
    }
  }
}

function focusInputAfterWindowRecover(window) {
  const drawer = qa('.toggle-content');

  if (window.isFocused) {
    drawer.forEach((el) => {
      if (!el.classList.contains('hide')) {
        el.querySelector('.input-control').focus();
      }
    });
  } else {
    console.log('Window focus lost...');
  }
}

function handleModalClose() {
  document.addEventListener('click', (e) => {
    if (
      e.target.matches(
        '.modal [data-dismiss="modal"], .modal [data-dismiss="modal"] *'
      )
    ) {
      let modal = e.path.find((el) => el.classList.contains('modal'));

      modal.classList.remove('show');
    }
  });
}

async function handleMouseHover() {
  //q('#toggle').click(); // TODO: remove

  q('#fav-apps').addEventListener('mousewheel', (e) => {
    // TODO: move
    if (q('.horizontal')) {
      q('#fav-apps').scrollLeft += Math.round(e.deltaY * 0.8);
      e.preventDefault();
    }
  });

  let closeTimeout;

  q('.app').addEventListener('mouseenter', (e) => {
    q('.view-port').classList.add('expand');
    q('.app').classList.add('expand-wrapper');

    if (closeTimeout) {
      clearTimeout(closeTimeout);
    }
  });

  q('.app').addEventListener('mouseleave', async (e) => {
    let { offsetWidth: viewPortWidth, offsetHeight: viewPortHeight } =
      q('.view-port');
    let margin = windowMargin;

    if (
      e.x < viewPortWidth + margin &&
      e.x > margin &&
      e.y < viewPortHeight + margin - 6 &&
      e.y > margin
    ) {
      console.warn('fake leave');
    }

    if (
      qa('.toggle-content:not(.hide)').length > 0 ||
      qa('.dropdown-menu.show').length > 0
    ) {
      return;
    }

    let viewPortBounds = q('.view-port').getBoundingClientRect();
    let outOfMonitor = isOutOfMonitor(viewPortBounds);

    if (await outOfMonitor) {
      console.warn('window is positioned outside of monitor. will not shrink');
      return;
    }

    closeTimeout = setTimeout(async () => {
      await applyOpenClasses();
      q('.view-port').classList.remove('expand');
      q('.app').classList.remove('expand-wrapper');
      qa('.toggle-content').forEach((e) => e.classList.add('hide'));
      // qa('[dropdown-id].show').forEach(e => e.classList.remove('show'));
    }, 500);
  });
}

async function handleNotificationClick() {
  const enableNotifications = getSetting('enableNotifications');

  if (enableNotifications) {
    notificationEnabledObs.subscribe((data) => {
      q('#notification-panel').classList[data ? 'remove' : 'add']('d-none');
    });
  }

  q('#notification-panel').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openNotificationPanel();
  });
}

function handleEnableNotificationsClick() {
  const notificationPanel = q('#notification-panel');
  const enableNotifications = q('#enable-notifications');
  const enableToasts = q('#enable-toasts');

  enableNotifications.addEventListener('click', (e) => {
    if (e.target.checked) {
      glue.notifications.configure({ enable: true, enableToasts: false });
      notificationPanel.classList.remove('d-none');
      enableToasts.disabled = false;
    } else {
      glue.notifications.configure({ enable: false, enableToasts: false });
      notificationPanel.classList.add('d-none');
      enableToasts.checked = false;
      enableToasts.disabled = true;
    }
  });
}

function handleEnableToastsClick() {
  const enableToasts = q('#enable-toasts');

  enableToasts.addEventListener('click', (e) => {
    if (e.target.checked) {
      glue.notifications.configure({ enableToasts: true });
    } else {
      glue.notifications.configure({ enableToasts: false });
    }
  });
}

async function handleFeedbackClick() {
  q('#feedback-panel').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openFeedbackForm();
  });
}

async function startTutorial() {
  const tutorialApp = await getApp('getting-started');
  const showTutorial = getSetting('showTutorial');

  if (!tutorialApp) {
    updateSetting({ showTutorial: false });
    q('.show-tutorial-check').classList.add('d-none');
  }

  if (showTutorial) {
    try {
      startApp('getting-started');
    } catch (e) {
      console.log('could not start Getting started app', e);
    }
  }
}

function getAppIcon(app = {}) {
  if (app.icon) {
    let icon = app.icon;

    if (!icon.includes('://')) {
      icon = 'data:image/png;base64, ' + icon;
    }
    return `<img src="${icon}" draggable="false" style="width:16px;"/>`;
  } else {
    return `<span class="icon-size-16">
    <i class="icon-app" draggable="false"></i>
  </span>`;
  }
}

// function clearSearch() {
//   searchInputObs.next('');
//   q('#app-search').value = '';
// }

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function isOutOfMonitor(viewportBounds) {
  let monitors = await getMonitorInfo();
  let windowBounds = await getWindowBounds();
  let leftMostPoint = monitors.reduce(
    (acc, curr) => (curr.workingAreaLeft < acc ? curr.workingAreaLeft : acc),
    0
  );
  let rightMostPoint = monitors.reduce(
    (acc, curr) =>
      curr.workingAreaLeft + curr.workingAreaWidth > acc
        ? curr.workingAreaLeft + curr.workingAreaWidth
        : acc,
    0
  );
  let visibleAreaLeft = windowBounds.left + viewportBounds.left;
  let visibleAreaRight =
    windowBounds.left + viewportBounds.left + viewportBounds.width;

  return visibleAreaLeft < leftMostPoint || visibleAreaRight > rightMostPoint;
}

function openDrawer(drawerId) {
  let menuButton = q(`[menu-button-id=${drawerId}]`);
  let hoverEvent = new MouseEvent('mouseenter', {
    view: window,
    bubbles: true,
  });

  menuButton.dispatchEvent(hoverEvent);
  menuButton.click();
}

export {
  handleClicks,
  handleOrientationChange,
  handleThemeChange,
  handleShutdownClick,
  handleTopMenuClicks,
  handleCloseDrawerClicks,
  handleNotificationClick,
  handleModalClose,
  handleMouseHover,
  focusInputAfterWindowRecover,
  windowMargin,
  startTutorial,
  // clearSearch,
  escapeHtml,
  getAppIcon,
  openDrawer,
};
