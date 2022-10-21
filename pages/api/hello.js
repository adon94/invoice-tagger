// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

async function readExcel() {
  // return await setTimeout(() => {
  return { poop: "poop" };
  // }, 2000)
}

export default async function handler(req, res) {
  try {
    const result = await readExcel();
    res.status(200).send({ result });
  } catch (err) {
    res.status(500).send({ error: "failed to fetch data" });
  }
}
