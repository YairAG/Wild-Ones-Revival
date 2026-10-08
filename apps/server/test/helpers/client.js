// Cliente mínimo que habla el protocolo del servidor (ver docs/PROTOCOL.md).
const net = require("net");

const HEADER = "Originality is undetected plagiarism.\r\n\r\n";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class TestClient {
  // path: "/ballistic/lobby?session=x", "/ballistic/game?gameId=..&session=..", etc.
  constructor(port, path) {
    this.port = port;
    this.path = path;
    this.buffer = "";
    this.messages = []; // mensajes recibidos y aún no consumidos con next()
    this.sawHeader = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.connect(this.port, "127.0.0.1", () => {
        this.socket.write(`POST ${this.path} HTTP/1.1\r\nHost: localhost\r\n\r\n`);
        resolve();
      });
      this.socket.on("error", reject);
      this.socket.on("data", (data) => this.onData(data.toString()));
    });
  }

  send(message) {
    const json = JSON.stringify(message);
    this.socket.write(String(json.length).padStart(6, "0") + json);
  }

  onData(text) {
    if (text.startsWith(HEADER)) {
      this.sawHeader = true;
      text = text.slice(HEADER.length);
    }
    this.buffer += text;
    // Saca todos los mensajes completos: 6 dígitos de longitud + JSON
    while (this.buffer.length >= 6) {
      const len = Number(this.buffer.slice(0, 6));
      if (this.buffer.length < 6 + len) break;
      this.messages.push(JSON.parse(this.buffer.slice(6, 6 + len)));
      this.buffer = this.buffer.slice(6 + len);
    }
  }

  // Espera el siguiente mensaje con ese command. Descarta los anteriores a él.
  async next(command, timeout = 3000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const i = this.messages.findIndex((m) => m.command === command);
      if (i >= 0) return this.messages.splice(0, i + 1).pop();
      await sleep(20);
    }
    throw new Error(`No llegó "${command}" en ${timeout} ms`);
  }

  // Envía un mensaje y devuelve todo lo que respondió el servidor. Manda detrás un ping de control:
  // el servidor atiende en orden, así que al llegar el ping_ack ya respondió al mensaje.
  async request(message) {
    this.messages.length = 0;
    this.send(message);
    this.send({ command: "ping" });
    const end = Date.now() + 3000;
    while (!this.messages.some((m) => m.command === "ping_ack")) {
      if (Date.now() > end) throw new Error(`Sin respuesta a "${message.command}"`);
      await sleep(20);
    }
    const i = this.messages.findIndex((m) => m.command === "ping_ack");
    return this.messages.splice(0, i + 1).slice(0, -1);
  }

  close() {
    this.socket.destroy();
  }
}

module.exports = { TestClient, sleep };
