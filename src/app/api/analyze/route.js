import { checkWebsite } from '../../cm_checker';

export async function POST(req) {
    try {
        const { website, banner, mode } = await req.json();

        // Validate inputs
        if (!website || !website.startsWith('https://')) {
            return new Response(JSON.stringify({ 
                message: 'Invalid website URL. Must start with https://',
                status: 'error' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Run the website check
        const result = await checkWebsite({ website, banner, mode });

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            message: `Server error: ${error.message}`,
            status: 'error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}