```
const ltEndpoint = 'https://freesubtitles.ai/translate'; 

const res = await fetch(ltEndpoint, {
    method: "POST",
    body: JSON.stringify({
        q: "Hey here is some translated text!",
        source: "auto",
        target: "es"
    }),
    headers: { "Content-Type": "application/json" }
});

console.log(await res.json());
```
