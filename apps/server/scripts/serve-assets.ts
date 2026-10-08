// Sirve los .dat del juego por HTTP (el servidor los descarga al arrancar desde ASSETS_URL).
// Uso: tsx scripts/serve-assets.ts [carpeta] [puerto]   → por defecto assets/json en el 8080
import http = require("http");
import fs = require("fs");
import path = require("path");

function serveAssets(dir: string, port: number | string): http.Server {
  return http
    .createServer((req, res) => {
      // basename: solo sirve archivos de esa carpeta (nada de "../")
      const file = path.join(dir, path.basename((req.url ?? "").split("?")[0]));
      fs.readFile(file, (err, data) => {
        res.writeHead(err ? 404 : 200);
        res.end(data);
      });
    })
    .listen(port);
}

export = serveAssets;

if (require.main === module) {
  const [dir = "assets/json", port = 8080] = process.argv.slice(2);
  serveAssets(dir, port);
  console.log(`Assets de ${dir} en http://localhost:${port}/`);
}
