---
title: ChatGPT注册与使用
categories:
    - - 技术
tags: [博客, 思念, ChatGPT]
toc: true
date: 2023-02-03 7:14:30
---

之前使用的是gpt镜像，一段时间就不可用了，还是注册官网比较稳定。

<!-- more -->

![ChatGPT界面](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031959912.png)

> ChatGPT是由人工智能研究实验室[OpenAI](https://openai.com/)在2022年11月30日发布的全新聊天机器人模型，一款人工智能技术驱动的自然语言处理工具。它能够通过学习和理解人类的语言来进行对话，还能根据聊天的上下文进行互动，真正像人类一样来聊天交流，甚至能完成撰写邮件、视频脚本、文案、翻译、代码等任务。    ----[百度百科](https://baike.baidu.com/item/ChatGPT/62446358)

## 注册

打开[ChatGPT](https://chat.openai.com/chat)，会提示注册。

如果显示`OpenAI‘s services are not available in your country`，则表明中国境内都被屏蔽了，不可使用。需要科学上网改变ip地址。见👉[OpenAI‘s services are not available in your country 完美解决方案 - 腾讯云开发者社区-腾讯云 (tencent.com)](https://cloud.tencent.com/developer/article/2190198)

如果仍不可行，可参照[中国区注册OpenAI账号试用ChatGPT指南 | Read dev Docs 博客](https://readdevdocs.com/blog/makemoney/中国区注册OpenAI账号试用ChatGPT指南.html#前期准备)。

只要注册成功并进入界面，之后无需科学上网即可使用。

## 使用

直接在页面底部输入栏对话即可。在左侧可以同时创建多个对话窗口。

### ChatGPT懂不懂思念

![](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302030954013.png)

网上是伤心者众吗？哈哈，笑死了😂🤣😆。

### 数据拟合测试

首先给定公式，然后提供数据，请求gpt生成测试代码。

![](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031059836.png)

![](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031100739.png)

![提供B的数据](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031101017.png)

![提供y的数据](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031102720.png)

![请求拟合](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031102121.png)

![生成matlab代码](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031103376.png)

![变限积分拟合](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031104765.png)

![生成完整代码](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202302031105904.png)

最后生成的代码如下：

```matlab
clear all
clc

% 定义常量C
C = 1;

% 定义常量B数组
B = [328 338 348 363 378 393 408 423 438 453 468 486 498 514 528 545 564 578 593 608];

% 定义y数组
y = [23.61872 23.72788 23.78942 24.0004 24.21821 24.37258 24.5136 24.67936 24.835 24.947 25.019 25.21346 25.31057 25.44604 25.56994 25.7252 25.86169 25.96159 26.05716 26.14056];

% 计算积分部分的数组
integral_part = zeros(1, length(B));
for i = 1:length(B)
    fun = @(x) (x.^6).*exp(x)./((exp(x) - 1).^2);
    integral_part(i) = integral(fun, 0, C/B(i));
end

% 构建矩阵X
X = [ones(length(B), 1) B'.^(-7) integral_part'];

% 构建系数矩阵beta
beta = (X' * X) \ (X' * y');

% 计算y0和A0
y0 = beta(1);
A0 = beta(2);

% 输出拟合结果
fprintf('y0 = %f\nA0 = %f\nC = %f\n', y0, A0, C);

```

放在matlab中运行没报错，但拟合变形了。因为只想做一个简单的测试，后续便没有再改动了。不过chatgpt的能力由此可见一斑，想象力有很大的发挥空间。

## ChatGPT镜像

以下镜像列表及相关应用为备用，使用体验不太好且可能随时失效。

- [ChatGPT演示版 (h2ai.cn)](http://chat.h2ai.cn/home)
- [ChatGPT国内版 - ai6.top](https://ai6.top/)
- [Ai Chat公益版 (sbaliyun.com)](https://chatgpt.sbaliyun.com/)
- ChatGPT智能对话（小程序）
