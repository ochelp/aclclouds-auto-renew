
async function solveCaptcha(page, prefix = '') {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const shotDir = path.resolve('shots');
  fs.mkdirSync(shotDir, { recursive: true });

  const diagnostic = {
    time: new Date().toISOString(),
    url: page.url(),
    title: '',
    frames: [],
    selectors: {},
    errors: []
  };

  const log = (message) => {
    console.log(
      `[CAPTCHA DIAGNOSTIC] ${message}`
    );
  };

  try {
    diagnostic.title = await page.title();
  } catch (e) {
    diagnostic.errors.push(
      `读取页面标题失败: ${e.message}`
    );
  }

  // 记录主页面及 iframe 的地址和状态
  for (const frame of page.frames()) {
    diagnostic.frames.push({
      url: frame.url(),
      name: frame.name()
    });
  }

  log(`页面地址: ${diagnostic.url}`);
  log(`页面标题: ${diagnostic.title}`);
  log(`Frame 数量: ${diagnostic.frames.length}`);

  // 检查常见验证码元素，不主动点击或破解验证码
  const selectors = {
    checkbox: 'div[role="checkbox"]',
    oldCaptchaImages: '.auth-captcha-option-img',
    oldCaptchaPrompt: '.auth-captcha-prompt',
    capWidget: 'cap-widget',
    captchaIframe: 'iframe[src*="captcha"]',
    turnstileIframe: 'iframe[src*="challenges.cloudflare.com"]',
    recaptchaIframe: 'iframe[src*="recaptcha"]'
  };

  for (const [name, selector] of Object.entries(selectors)) {
    try {
      diagnostic.selectors[name] =
        await page.locator(selector).count();
    } catch (e) {
      diagnostic.selectors[name] = '检查失败';
      diagnostic.errors.push(
        `${name}: ${e.message}`
      );
    }
  }

  // 检查各个 Frame 中是否存在相应元素
  for (let i = 0; i < page.frames().length; i++) {
    const frame = page.frames()[i];

    try {
      const count = await frame
        .locator('div[role="checkbox"]')
        .count();

      diagnostic.frames[i].checkboxCount = count;
    } catch (e) {
      diagnostic.frames[i].checkboxError = e.message;
    }
  }

  log(
    `元素检查结果: ${JSON.stringify(
      diagnostic.selectors
    )}`
  );

  log(
    `Frame 检查结果: ${JSON.stringify(
      diagnostic.frames
    )}`
  );

  // 保存当前页面截图，便于在 GitHub Actions 中排查
  try {
    const screenshotPath = path.join(
      shotDir,
      'captcha-diagnostic.png'
    );

    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    log(`诊断截图已保存: ${screenshotPath}`);
  } catch (e) {
    diagnostic.errors.push(
      `截图失败: ${e.message}`
    );
  }

  // 保存诊断数据，不包含账号密码或 Cookie
  try {
    fs.writeFileSync(
      path.join(shotDir, 'captcha-diagnostic.json'),
      JSON.stringify(diagnostic, null, 2),
      'utf8'
    );
  } catch (e) {
    log(`保存诊断文件失败: ${e.message}`);
  }

  const checkboxCount =
    diagnostic.selectors.checkbox;

  const oldCaptchaCount =
    diagnostic.selectors.oldCaptchaImages;

  const capWidgetCount =
    diagnostic.selectors.capWidget;

  if (
    checkboxCount === 0 &&
    oldCaptchaCount === 0 &&
    capWidgetCount === 0
  ) {
    throw new Error(
      '未找到预期的验证码元素。' +
      '可能是页面结构变化、验证码尚未加载，' +
      '或验证组件位于其他 Frame/Shadow DOM。' +
      '请检查 shots/captcha-diagnostic.png ' +
      '和 shots/captcha-diagnostic.json。'
    );
  }

  throw new Error(
    '已检测到验证码相关组件，但本函数仅执行诊断，' +
    '不会自动点击、破解或绕过 CAPTCHA。' +
    '请通过网站支持的人工验证或官方授权方式完成验证，' +
    '再继续登录和续期。'
  );
}
