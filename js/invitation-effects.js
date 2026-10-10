(function () {
  const mapUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3735.605119630992!2d105.91187409999999!3d20.563331599999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135cf002cb7a671%3A0x81cf410932a4ac88!2zTmjDoCB2xrDhu51uIEjGsG5nIFF1eeG6v3Q!5e0!3m2!1sen!2s!4v1791601183044!5m2!1sen!2s";

  function replaceMapUrl(frame) {
    if (frame.src.includes("maps/embed/v1/place") && frame.src !== mapUrl) {
      frame.src = mapUrl;
    }
  }

  function scan(node) {
    if (node instanceof HTMLIFrameElement) replaceMapUrl(node);
    node.querySelectorAll?.("iframe").forEach(replaceMapUrl);
  }

  document.querySelectorAll("iframe").forEach(replaceMapUrl);

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") replaceMapUrl(mutation.target);
      else mutation.addedNodes.forEach(scan);
    }
  }).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"]
  });
})();
