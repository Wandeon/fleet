const port = process.env.HTTP_PORT ?? '3015';
const url = `http://127.0.0.1:${port}/healthz`;

async function main() {
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${process.env.API_BEARER ?? ''}` } });
    if (!response.ok) {
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

main();
