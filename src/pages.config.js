import CPRTracker from './pages/CPRTracker';
import Records from './pages/Records';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CPRTracker": CPRTracker,
    "Records": Records,
}

export const pagesConfig = {
    mainPage: "CPRTracker",
    Pages: PAGES,
    Layout: __Layout,
};