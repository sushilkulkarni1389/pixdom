export async function loadPage(page, input) {
    switch (input.type) {
        case 'html':
            await page.setContent(input.html, { waitUntil: 'networkidle' });
            break;
        case 'file':
            await page.goto(`file://${input.path}`, { waitUntil: 'networkidle' });
            break;
        case 'url':
            await page.goto(input.url, { waitUntil: 'networkidle' });
            break;
    }
}
