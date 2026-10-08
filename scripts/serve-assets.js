// Sirve los .dat del juego por HTTP (el servidor los descarga al arrancar desde ASSETS_URL).
// Uso: node scripts/serve-assets.js [carpeta] [puerto]   → por defecto assets/json en el 8080
const http = require("http");
const fs = require("fs");
const path = require("path");

function serveAssets(dir, port) {
  return http
    .createServer((req, res) => {
      const file = path.join(dir, path.basename(req.url.split("?")[0]));
      fs.readFile(file, (err, data) => {
        res.writeHead(err ? 404 : 200);
        res.end(data);
      });
    })
    .listen(port);
}

module.exports = serveAssets;

if (require.main === module) {
  const [dir = "assets/json", port = 8080] = process.argv.slice(2);
  serveAssets(dir, port);
  console.log(`Assets de ${dir} en http://localhost:${port}/`);
}
