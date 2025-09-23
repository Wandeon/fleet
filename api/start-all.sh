#!/bin/sh
# Start both API server and worker processes

echo "Starting Fleet API..."
npm start &
API_PID=$!

echo "Starting Worker..."
npm run worker &
WORKER_PID=$!

echo "API PID: $API_PID"
echo "Worker PID: $WORKER_PID"

# Wait for both processes
wait $API_PID $WORKER_PID