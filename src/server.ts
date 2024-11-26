import { Builder, By, WebDriver, until } from 'selenium-webdriver';

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
      .usingServer('http://localhost:4444/wd/hub') // Replace with the Selenium Grid hub URL
      .forBrowser('firefox') // Specify the browser (chrome, firefox, etc.)
      .build();
    await driver.get('https://www.openlane.eu/en/home')
    await driver.sleep(5000);
    await driver.findElement(By.id('onetrust-accept-btn-handler')).click();
    await driver.findElement(By.xpath('//*[@id="loginButton2"]')).click();
    await driver.sleep(1000);
    await driver.findElement(By.xpath('//*[@id="react-root"]/div/div[2]/div[2]/div/main/div/div[1]/div/div/div/input')).sendKeys(user);
    await driver.sleep(1000);
    await driver.findElement(By.xpath('//*[@id="loginButton4"]')).click();
    await driver.sleep(1000);
    await driver.findElement(By.xpath('//*[@id="react-root"]/div/div[2]/div[2]/div/main/div/div[2]/div/div/div/input')).sendKeys(pass);
    await driver.sleep(1000);
    await driver.findElement(By.xpath('//*[@id="loginButton3"]')).click();
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
    const imgElements = await driver.findElements(By.css('.image-gallery-thumbnail-inner img'));

    ad.firstReg = await driver.findElement(By.xpath("//div[@data-attr='car-first-registration']")).getText();
    ad.mileage = await driver.findElement(By.xpath("//div[@data-attr='car-mileage']")).getText();
    ad.fuel = await driver.findElement(By.xpath("//div[@data-attr='car-fuel']")).getText();
    ad.transmission = await driver.findElement(By.xpath("//div[@data-attr='car-transmission']")).getText();
    ad.kw = await driver.findElement(By.xpath("//div[@data-attr='car-kw']")).getText();
    ad.engineSize = await driver.findElement(By.xpath("//div[@data-attr='car-engine']")).getText();
    ad.vin = await driver.findElement(By.xpath("//div[@data-attr='car-chassisnumber']")).getText();
    ad.color = await driver.findElement(By.xpath("//div[@data-attr='car-paint']")).getText();
    ad.ddv = await driver.findElement(By.xpath("//*[@id='react-root']/div/div/div[4]/div[2]/div[1]/div[4]/section[2]/div[2]/div/div/div[2]")).getText();
    ad.lokacija = await driver.findElement(By.xpath("//a[contains(@class, 'uitest-address-link')]")).getText();
    ad.possiblePrice = await driver.findElement(By.className('price-amount')).getText();
    await driver.findElement(By.className('uitest-tab-delivery')).click();
    await driver.sleep(5000);
    ad.deliveryPrice = await driver.findElement(By.xpath("//div[contains(@class, 'rc-CarDeliveryOptions')]/div[2]/div/div/div/table/tbody/tr[2]/td[1]/h4")).getText();
    ad.deliveryTime = await driver.findElement(By.xpath("//div[contains(@class, 'rc-CarDeliveryOptions')]/div[2]/div/div/div/table/tbody/tr[2]/td[1]/p[2]")).getText();
    ad.imageUrls = await Promise.all(imgElements.map(async (img) => {
      const parentOfParent = await img.findElement(By.xpath('ancestor::a')).getAttribute('class');
      const src = (await img.getAttribute('src'));
      const splitSrc = src.replace('?size=150', '').split('/');
      return {
        img: `https://images.openlane.eu/carimgs/${splitSrc[splitSrc.length - 2]}/${parentOfParent.includes('thumbnail-damaged') ? 'damage' : 'general'}/${splitSrc[splitSrc.length - 1]}`,
        thumbnail: src
      }
    }));
    console.log(ad);
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
