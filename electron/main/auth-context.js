// Who is signed in.
//
// The desktop app has one person per window, kept in a module variable.
// The web server (server/web-server.js) has many people at once: it runs
// each request inside runWithUser(), and the handlers' calls below then read
// and change that request's own value instead. The handlers do not need to
// know which of the two they are running in.
const { AsyncLocalStorage } = require("node:async_hooks");

const requestContext = new AsyncLocalStorage();
let currentUserId = null;

function setCurrentUser(userId) {
    const store = requestContext.getStore();
    if (store) store.userId = userId;
    else currentUserId = userId;
}

function getCurrentUserId() {
    const store = requestContext.getStore();
    return store ? store.userId : currentUserId;
}

function clearCurrentUser() {
    setCurrentUser(null);
}

// Runs fn as the given user (null = nobody). Resolves to
// { result, userId }: userId is who is signed in afterwards (changed by
// sign-in or sign-out inside fn).
async function runWithUser(userId, fn) {
    const store = { userId: userId ?? null };
    const result = await requestContext.run(store, fn);
    return { result, userId: store.userId };
}

module.exports = {
    setCurrentUser,
    getCurrentUserId,
    clearCurrentUser,
    runWithUser
};
