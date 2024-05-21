
onmessage = (e) => {
    const url = e.data;
    fetch(new Request(url))
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} ${response.url}`);
            }
            return response.json();
        })
        .then((data) => {
            //console.log("worker posting data with url: " + url);
            postMessage({ url: url, json: data });
        })
};
