/**
 * Export server.js to Node servers, 
 * and browser.js to module bundlers.
 */

module.exports = global.oatServer ? oatServer('./server') : require('./browser');
