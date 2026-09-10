export const workflowXmlFeed = `<?xml version="1.0"?>
  <rss xmlns:g="http://base.google.com/ns/1.0"><channel>
    <item>
      <g:id>TEA&amp;CUP</g:id>
      <title><![CDATA[Tea & Cup ★]]></title>
      <description>Green &amp; bright &#x2605;</description>
      <g:availability>in stock</g:availability><g:condition>new</g:condition>
      <g:price>19,90 CHF</g:price><g:sale_price>15,50 CHF</g:sale_price>
      <link>https://shop.example/tea?size=large&amp;color=green</link>
      <g:image_link>https://images.example/tea.jpg</g:image_link><g:brand>Leaf &amp; Co</g:brand>
    </item>
    <item>
      <g:id>NO-IMAGE</g:id><title>Tea tin</title>
      <description>A complete product description.</description>
      <g:availability>in stock</g:availability><g:condition>new</g:condition>
      <g:price>9.00 CHF</g:price><link>https://shop.example/tin</link><g:brand>Leaf</g:brand>
    </item>
  </channel></rss>`;

export function workflowCsvFeed(rowCount = 75): string {
  const header = "id,title,description,availability,condition,price,sale_price,link,image_link,brand";
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const row = index + 1;
    const price = index === 60 ? "12.34.56 CHF" : "19.90 CHF";
    const salePrice = index === 0 ? "15.50 CHF" : "";
    const image = index === 61 ? "" : `https://images.example/${row}.jpg`;
    const title = index === 0
      ? "A deliberately long sale title for the complete catalog workflow fixture"
      : `Workflow product ${row}`;
    return [
      `SKU-${row}`,
      title,
      "A complete fixture product description.",
      "in stock",
      "new",
      price,
      salePrice,
      `https://shop.example/products/${row}`,
      image,
      "Workflow Fixture",
    ].map((value) => `"${value.replaceAll('"', '""')}"`).join(",");
  });
  return [header, ...rows].join("\n");
}
