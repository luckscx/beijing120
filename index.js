const cheerio = require("cheerio")
const axios = require("axios")
const fs = require('node:fs/promises');
const old_fs = require('fs')
const stream = require('stream');
const promisify = require("util").promisify
const FormData = require('form-data');
const bluebird = require('bluebird')

const host = "https://www.beijing120.com"
const inst = axios.create({
    baseURL: host,
    timeout: 2000,
});


async function getListPage(page_num) {
    let data = new FormData();
    data.append('page',page_num);
    data.append('channelId',238);
    const resp = await inst.post('/page', data)
    let json = resp.data
    return json
}

const finished = promisify(stream.finished);

async function downloadFile(fileUrl, outputLocationPath) {
    return axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
    }).then(response => {
        const writer = old_fs.createWriteStream(outputLocationPath);
        response.data.pipe(writer);
        return finished(writer); //this is a Promise
    });
}

async function getDayPage(date, title, page_id,content_id) {
    let res = title.match(/(\d+)月(\d+)日/)
    let data_day = res[0]
    let pdf_file_name = `./out/${date}_${data_day}.pdf`
    let blank_file = `./out/${date}_${data_day}_404.txt`
    if (old_fs.existsSync(pdf_file_name) || old_fs.existsSync(blank_file)) {
        return
    }
    let data = new FormData();
    data.append('pageCurr',page_id);
    data.append('channelId',238);
    const url = `/content/${content_id}`
    try {
        const resp = await inst.post(url, data)
        const html = resp.data
        $ = cheerio.load(html)
        let link = $(".article_all p a").attr("href")
        if (link && data_day) {
            console.log(link)
            console.log(pdf_file_name)
            await downloadFile(link,pdf_file_name)
        } else {
            console.log(`error ${url}`)
        }
    } catch (err) {
        if (err && err.response) {
            console.log(err.response.status)
            if (err.response.status === 404)  {
                let fh = await fs.open(blank_file, 'a');
                await fh.close();
            }
        } else {
          console.log(err);
        }
    }
}

async function main(){
  const page_list = []
  for (let i = 1; i < 96; i++) {
    page_list.push(i)
  }
  await bluebird.map(page_list, async (page) => {
    let list = await getListPage(page)
    if (list && list.data.length > 0) {
      for (const obj of list.data) {
        await getDayPage(obj.date, obj.title, page, obj.id)
      }
    }
  }, {concurrency: 8}).then(() => {
    console.log("done")
  })
}

main()
