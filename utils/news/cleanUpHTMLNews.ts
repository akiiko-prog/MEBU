export const cleanHtmlForArticle = (htmlString: string): string => {
  const specialDelimiter = "<br />";

  let cleaned = htmlString
    .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
    .replace(/&nbsp;/g, " ") // Replace non-breaking spaces with standard space
    .replace(/\r/g, "") // Remove carriage returns
    .trim();

  cleaned = cleaned.replace(/<([a-z0-9]+)(\s+[^>]*)*>/gi, (match, tagName) => {
    const lowerTag = tagName.toLowerCase();

    if (lowerTag === "a") {
      const hrefMatch = match.match(/href=["']([^"']+)["']/i);
      const href = hrefMatch ? ` href="${hrefMatch[1]}"` : "";
      return `<a${href}>`;
    }

    return `<${lowerTag}>`;
  });

  cleaned = cleaned.replace(/<\/?(?:span|div|br)\b[^>]*>/gi, specialDelimiter);

  cleaned = cleaned.replace(
    new RegExp(`${specialDelimiter}+`, "g"),
    specialDelimiter
  );
  cleaned = cleaned.replace(
    new RegExp(`^${specialDelimiter}|${specialDelimiter}$`, "g"),
    ""
  );

  const blocks = cleaned
    .split(specialDelimiter)
    .map(block => block.trim())
    .filter(block => block.length > 0);

  let finalHtml = "";
  // Regex to detect blocks starting with a bullet point (• or -) followed by optional space.
  const listMarkerRegex = /^[\•\-]\s*(.*)$/;
  // Updated set of allowed tags for cleanup step a)
  const allowedTagsRegex = "h[1-4]|p|b|i|a|u|ul|ol|li";

  blocks.forEach(block => {
    block = block
      .replace(new RegExp(`<(?!\/?(?:${allowedTagsRegex})\\b)[^>]+>`, "ig"), "")
      .trim();

    if (block.length === 0) {
      return;
    } // Skip empty blocks after cleanup

    // Prevent nested <p> tags by stripping leading/trailing <p> tags from the block content
    block = block
      .replace(/^<p>\s*/i, "")
      .replace(/\s*<\/p>$/i, "")
      .trim();

    const listMatch = block.match(listMarkerRegex);

    if (listMatch) {
      const listItemContent = listMatch[1].trim();

      // Encapsulate each list item in its own <ul> block, followed by the specialDelimiter.
      finalHtml += `<ul><li>${listItemContent}</li></ul>${specialDelimiter}`;
    } else {
      finalHtml += `<p>${block}</p>${specialDelimiter}`;
    }
  });

  return finalHtml
    .trim()
    .replace(new RegExp(specialDelimiter + "+$"), "") // Remove trailing delimiters
    .replace(new RegExp(`${specialDelimiter}+`, "g"), "")
    .replace(/\s+/g, " ");
};
