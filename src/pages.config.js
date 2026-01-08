import Records from './pages/Records';
import CPRTracker from './pages/CPRTracker';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Records": Records,
    "CPRTracker": CPRTracker,
}

export const pagesConfig = {
    mainPage: "CPRTracker",
    Pages: PAGES,
    Layout: __Layout,
};