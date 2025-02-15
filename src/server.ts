import { Builder, By, WebDriver, Key } from 'selenium-webdriver';
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import axios from 'axios';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './price.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const priceProto: any = grpc.loadPackageDefinition(packageDefinition).PriceService;
const client = new priceProto('localhost:50051', grpc.credentials.createInsecure());

function invokeUpdatePricesForId(id: string) {
  client.UpdatePricesForId({ id }, (err: any, response: any) => {
    if (err) {
      console.error('Error invoking UpdatePricesForId:', err.message);
      return;
    }
    console.log(`Response for ID "${id}":`, response.success ? 'Success' : 'Failure');
  });
}

const s3Client = new S3Client({
  forcePathStyle: true,
  region: process.env.S3REGION!,
  endpoint: process.env.S3ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3ACCESSKEYID!,
    secretAccessKey: process.env.S3SECRETACCESSKEY!,
  }
})
// Create a single supabase client for interacting with your database
if(process.env.SUPABASEURL === undefined || process.env.SUPABASEKEY === undefined) {
  console.error('Please set ENV variables');
  while(1){}
}
const supabase = createClient(process.env.SUPABASEURL!, process.env.SUPABASEKEY!)

async function dismissAndRetry(driver: WebDriver, action: () => Promise<void>, maxRetries = 10): Promise<void> {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      await action();
      return; // If successful, exit the loop
    } catch (error: any) {
      if (
        error.message.includes('is not clickable at point')
      ) {
        console.warn(`Retry ${attempts + 1}: Dismissing overlay and retrying...`);
        await driver.actions().sendKeys(Key.ESCAPE).perform(); // Send ESC key to dismiss the overlay
        await driver.sleep(1000); // Wait for the popup to be dismissed
      } else {
        throw error; // Rethrow if it's not the expected error
      }
    }
    attempts++;
  }
  throw new Error(`Failed to perform the action after ${maxRetries} retries.`);
}

async function login(driver: WebDriver, user: string, pass: string): Promise<void> {
  try {
    await driver.navigate().refresh();
    await driver.sleep(1000);
    await driver.actions().sendKeys(Key.ESCAPE).perform();
    await driver.sleep(1000);
    console.log('Starting login process...');
    // Click the login button to open the login form
    await driver.findElement(By.xpath('//*[@id="loginButton2"]')).click();
    await driver.sleep(1000);

    // Enter username
    const usernameField = await driver.findElement(By.xpath('//*[@id="react-root"]/div/div[2]/div[2]/div/main/div/div[1]/div/div/div/input'));
    await usernameField.sendKeys(user);

    // Click the continue button
    await driver.findElement(By.xpath('//*[@id="loginButton4"]')).click();
    await driver.sleep(1000);

    // Enter password
    const passwordField = await driver.findElement(By.xpath('//*[@id="react-root"]/div/div[2]/div[2]/div/main/div/div[2]/div/div/div/input'));
    await passwordField.sendKeys(pass);

    // Click the login button
    await driver.findElement(By.xpath('//*[@id="loginButton3"]')).click();
    await driver.sleep(1000);

    console.log('Login process completed successfully.');
  } catch (error) {
    console.error('Error during login:', error);
    throw error; // Re-throw to allow retry
  }
}

async function scrapeWithSeleniumGrid() {
  let driver: WebDriver | null = null;
  const user = process.env.OPENLANEUSER;
  const pass = process.env.OPENLANEPASS;
  if (user === undefined || pass === undefined) {
    console.error('Please set OPENLANEUSER and OPENLANEPASS environment variables');
    return;

  }
  try {
    // Create a WebDriver instance connected to Selenium Grid
    driver = await new Builder()
      .usingServer('http://localhost:4444/wd/hub') // Selenium Grid hub URL
      .forBrowser('firefox') // Specify the browser
      .build();

    await driver.get('https://www.openlane.eu/en/home');
    await driver.sleep(5000);

    // Accept cookies if present
    try {
      const cookieButton = await driver.findElement(By.id('onetrust-accept-btn-handler'));
      await cookieButton.click();
    } catch (err) {
      console.log('Cookie acceptance button not found or already dismissed.');
    }

    // Retry the entire login process
    await dismissAndRetry(driver, async () => {
      await login(driver!, user, pass);
    });

    console.log('Login retry mechanism completed successfully.');
    await driver.sleep(10000);
    await driver.actions().sendKeys(Key.ESCAPE).perform();
    await driver.sleep(1000);
    await driver.get('https://www.openlane.eu/sl/findcar?fuelTypes=Benzine%2CElectric%2CHybride%2CDiesel&damageTypes=1&auctionTypes=5%2C4%2C2%2C1'); // Replace with your target website

    await driver.sleep(5000);
    // Example: Extract elements (e.g., h1 texts)
    const headings = await driver.findElements(By.xpath('//*[@id="react-root"]/div/div/div/div/div/div/div/section/section/div/div/div/h3'));
    console.log(headings);
    var ads: any[] = [];
    for (const heading of headings) {
      ads.push({
        title: await heading.getText(),
        url: await heading.findElement(By.xpath('a')).getAttribute('href')
      });
    }
    for (var ad of ads) {
      await driver.get(ad.url);
      await driver.sleep(5000);
      var images: { img: string; thumbnail: string; }[] = []
      await driver.actions().sendKeys(Key.ESCAPE).perform();

      const imgElements = await driver.findElements(By.css('.image-gallery-thumbnail-inner img'));
        //console.log('imgElements', imgElements);
          imgElements.map(async (img) => {
            const parentOfParent = await img.findElement(By.xpath('ancestor::a')).getAttribute('class');
            const src = (await img.getAttribute('src'));
            const splitSrc = src.replace('?size=150', '').split('/');
            images.push({
                img: `https://images.openlane.eu/carimgs/${splitSrc[splitSrc.length - 2]}/${parentOfParent.includes('thumbnail-damaged') ? 'damage' : 'general'}/${splitSrc[splitSrc.length - 1]}`,
                thumbnail: src
              });

          })
       

      ad.vendor = 1;
      const urlParams = new URLSearchParams(new URL(ad.url).search);
      ad.vendorId = urlParams.get('auctionId');
      ad.firstReg = await driver.findElement(By.xpath("//div[@data-attr='car-first-registration']")).getText();
      var [day, month, year] = ad.firstReg.split('/').map(Number);
      ad.firstReg = new Date(year, month - 1, day); // Month is zero-based
      ad.mileage = (await driver.findElement(By.xpath("//div[@data-attr='car-mileage']")).getText()).replace(/\D/g, '');
      ad.fuel = await driver.findElement(By.xpath("//div[@data-attr='car-fuel']")).getText();
      ad.transmission = await driver.findElement(By.xpath("//div[@data-attr='car-transmission']")).getText();
      ad.kw = (await driver.findElement(By.xpath("//div[@data-attr='car-kw']")).getText()).split(' ')[0];
      ad.engineSize = (await driver.findElement(By.xpath("//div[@data-attr='car-engine']")).getText()).replace(/\D/g, '');
      ad.vin = await driver.findElement(By.xpath("//div[@data-attr='car-chassisnumber']")).getText();
      ad.color = await driver.findElement(By.xpath("//div[@data-attr='car-paint']")).getText();
      ad.vat = [25, 22, 19, 21][Math.floor(Math.random() * 4)];
      ad.location = await driver.findElement(By.xpath("//a[contains(@class, 'uitest-address-link')]")).getText();
      ad.possiblePrice = (await driver.findElement(By.className('price-amount')).getText()).split(',')[0].replace(/\D/g, '');
      await driver.findElement(By.className('uitest-tab-delivery')).click();
      await driver.sleep(5000);
      ad.deliveryPrice = 570
      ad.deliveryWindowStart = new Date();
      ad.deliveryWindowStart.setDate(ad.deliveryWindowStart.getDate() + Math.floor(Math.random() * (15 - 7 + 1)) + 7);
      ad.deliveryWindowEnd = new Date();
      ad.deliveryWindowEnd.setDate(ad.deliveryWindowStart.getDate() + Math.floor(Math.random() * (45 - 30 + 1)) + 30);

      //https://www.openlane.eu/sl/carv6/transportoptions?auctionId=8787142
      const { data, error } = await supabase.from('auction_listings').insert([ad]).select();
      if (error) {
        console.error('Error inserting data:', error);
      } else {
        console.log('Data inserted successfully:', data);
        invokeUpdatePricesForId(data[0].id);


        let i = 1;
        for (const image of images) {
          console.log(image);
          const imgid = uuidv4();
          const imgres = await uploadFileFromUrl(image.img, process.env.S3BUCKET!, `${imgid}.jpg`);
          console.log('imgres', imgres);
          if (imgres != false) {
            console.log({
              auction_listing_id: data[0].id,
              img: `${process.env.S3ENDPOINT!}/${process.env.S3BUCKET!}/${imgres}`,
            });
            const { data: d2, error: e2 } = await supabase.from('auction_listing_photos').insert([{
              auction_listing_id: data[0].id,
              img: `${process.env.S3ENDPOINTPUBLIC!}/${process.env.S3BUCKET!}/${imgres}`,
              number: i
            }])
            i++;
            if (e2) {
              console.error('Error inserting image data:', d2, e2);
            } else {
              console.log('Image data inserted successfully:', d2);
            }
          }
        }



          

        // const imgElements = await driver.findElements(By.css('.image-gallery-thumbnail-inner img'));
        // console.log('imgElements', imgElements);
        // try {
        //   imgElements.map(async (img) => {
        //     console.log('img', img);
        //     const parentOfParent = await img.findElement(By.xpath('ancestor::a')).getAttribute('class');
        //     const src = (await img.getAttribute('src'));
        //     const splitSrc = src.replace('?size=150', '').split('/');
        //     const { data: d2, error: e2 } = await supabase.from('auction_listing_photos').insert([{
        //       auction_listing_id: data[0].id,
        //       img: `https://images.openlane.eu/carimgs/${splitSrc[splitSrc.length - 2]}/${parentOfParent.includes('thumbnail-damaged') ? 'damage' : 'general'}/${splitSrc[splitSrc.length - 1]}`,
        //       thumbnail: src
        //     }]).select();
        //     console.log(d2, e2)
        //   })
        // } catch (error) {
        //   console.error('Error:', error
        //   );
        // }
      }
      //console.log(ad);
    }



  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Quit the driver
    if (driver) {
      await driver.quit();
    }
  }
}

scrapeWithSeleniumGrid();



async function uploadFileFromUrl(url: string, bucket: string, key: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    const file = response.data;
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: 'image/jpeg',
      },
    });

    const res = await upload.done();
    console.log('upload', res);
    if(res.$metadata.httpStatusCode == 200) {
    return key;
    } else {
      return false;
    }
} 
