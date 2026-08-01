import { app } from './app';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  process.stdout.write(`notes-web backend escuchando en el puerto ${PORT}\n`);
});
