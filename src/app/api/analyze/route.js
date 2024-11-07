export async function POST(req) {
  const { website, banner, mode } = await req.json();
  console.log({ website, banner, mode }); // Log the input to verify
  // Here you would call your Puppeteer script with the provided data
  // For now, we'll just return the received data as a placeholder
  return new Response(JSON.stringify({ message: 'Analysis started', website, banner, mode }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}