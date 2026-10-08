// Cliente mínimo que habla el protocolo del servidor (ver docs/PROTOCOL.md).
import net = require("net");

const HEADER = "Originality is undetected plagiarism.\r\n\r\n";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mensaje recibido: JSON arbitrario del servidor (en los tests se leen campos sueltos sin tiparlos)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Message = { command: string; [key: string]: any };

class TestClient {
  port: number;
  path: string;
  buffer = "";
  messages: Message[] = []; // mensajes recibidos y aún no consumidos con next()
  sawHeader = false;
  socket!: net.Socket;

  // path: "/ballistic/lobby?session=x", "/ballistic/game?gameId=..&session=..", etc.
  constructor(port: number, path: string) {
    this.port = port;
    this.path = path;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.connect(this.port, "127.0.0.1", () => {
        this.socket.write(`POST ${this.path} HTTP/1.1\r\nHost: localhost\r\n\r\n`);
        resolve();
      });
      this.socket.on("error", reject);
      this.socket.on("data", (data) => this.onData(data.toString()));
    });
  }

  send(message: object): void {
    const json = JSON.stringify(message);
    this.socket.write(String(json.length).padStart(6, "0") + json);
  }

  onData(text: string): void {
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
  async next(command: string, timeout = 3000): Promise<Message> {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const i = this.messages.findIndex((m) => m.command === command);
      if (i >= 0) return this.messages.splice(0, i + 1).pop()!;
      await sleep(20);
    }
    throw new Error(`No llegó "${command}" en ${timeout} ms`);
  }

  // Envía un mensaje y devuelve todo lo que respondió el servidor. Manda detrás un ping de control:
  // el servidor atiende en orden, así que al llegar el ping_ack ya respondió al mensaje.
  async request(message: { command: string }): Promise<Message[]> {
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

  close(): void {
    this.socket.destroy();
  }
}

export { TestClient, sleep };
export type { Message };
