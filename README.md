# Daymark To-do

A responsive to-do website with a Node.js API and JSON-file persistence. It has no third-party runtime dependencies.

## Run locally

Requires Node.js 20 or newer.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Tasks are stored in `data/tasks.json`. Set `PORT` to change the listening port or `DATA_FILE` to use a different JSON data file.

## Run with Docker

```sh
docker build -t daymark-todo .
docker run --name daymark-todo -p 3000:3000 -v daymark-data:/app/data daymark-todo
```

The named volume keeps tasks available across container restarts and image updates. Open [http://localhost:3000](http://localhost:3000).
