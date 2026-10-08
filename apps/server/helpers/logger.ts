class Logger {
  filename: string;

  constructor(filename: string) {
    this.filename = filename + ".log";
  }

  write(text: string): void {
    const logText = new Date().toString() + " -- " + text + "\n";

    // @ts-expect-error bug: falta importar fs (ver docs/BUGS.md)
    fs.appendFile("logs/" + this.filename, logText, () => {});
  }
}

export = Logger;
