export async function postResult(payload){
  const res = await fetch("/api/results", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload),
    credentials: "include"
  });
  if (!res.ok) throw new Error("postResult failed");
  return res.json();
}
