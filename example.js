const puppeteer = require('puppeteer');
var fs = require('fs');
var tesseract = require('tesseract.js');
var gm = require('gm');

/**
 * 对图片进行阈值处理
 * @param {*} imgPath 当前文件名
 * @param {*} newPath 降噪后的新文件名
 * @param {*} thresholdValue 降噪率，越小降噪越强
 */
function disposeImg (imgPath, newPath, thresholdValue) {
  return new Promise((resolve, reject) => {
    gm(imgPath)
        .threshold(thresholdValue || 88)
        .flatten()
        .setFormat('jpeg')
        .toBuffer((err, buffer) => {
            if (err) {
                reject(err);
            } else {
                resolve(newPath);
                fs.writeFileSync(newPath, buffer);
            }
        });
  });
}

/**
 * 识别阈值化后图片内容
 */
function recognizeImg (imgPath, options) {
  options = Object.assign({psm: 3}, options || {});

  return new Promise((resolve, reject) => {
      
    tesseract.recognize(imgPath, options)
        .progress(message => {})
        .catch(err => {
            reject(err)
        })
        .then(result => {
            // 去掉识别结果中的换行回车空格
            let text = result && result.text ? result.text.replace(/[\r\n\s]/gm, '') : ''
            resolve(text);
        })
  });
}

(async () => {
    const browser = await puppeteer.launch({headless:false});
    const page = await browser.newPage();
    await page.goto('http://thzwb.thnet.gov.cn/web/jsp/bsy/appointment.jsp');
    await page.type('#loginName', 'loginName');
    await page.type('#loginPwd', 'loginPwd');
    // get code
    async function getResourceContent(page, url) {
        const { content, base64Encoded } = await page._client.send(
            'Page.getResourceContent',
            { frameId: String(page.mainFrame()._id), url },
        );
        assert.equal(base64Encoded, true);
        return content;
    }
    const imgPath = 'code.png'
    const newPath = 'new.jpg'
    await page.waitForSelector('#codeIm');
    const url = await page.$eval('#codeIm', i => i.src);
    const content = await getResourceContent(page, url);
    const contentBuffer = Buffer.from(content, 'base64');
    fs.writeFileSync(imgPath, contentBuffer, 'base64');
    // read code
    async function recognize(imgPath, newPath, thresholdValue) {
        try {
            const newImgPath = await disposeImg(imgPath, newPath, thresholdValue)
            const result = await recognizeImg(newImgPath)
            return result
            console.log(`识别结果:${result}`)
        } catch (err) {
            console.error(`识别失败:${err}`);
            await browser.close();
        }
    }
    let text = await recognize(imgPath, newPath)
    await page.type('#tempValidateCode', text);
    await Promise.all([
        // login
        await page.click("#userLoginBtn"),
        await page.screenshot({path: 'example.png'})
    ])

    // await browser.close();
})();
