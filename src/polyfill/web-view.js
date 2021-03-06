var videoJs = require('videojs'),
	util = require('util'),
	url = require('url'),
	$ = require('jquery-browserify'),
	{EventEmitter} = require('events'),
	getFrameElement = require('../frame-to-element');

const inIframe = window !== window.top ;


// todo: handle this like a grownup
try {
	var css = require('./style.scss');
}
catch (e){}

var WebView = function(options){
	EventEmitter.call(this);

	var self = this,
		STANDARD_SIZES = {
			'480x80': true,
			'300x50': true,
			'320x50': true,
			'320x250': true,
			'728x90': true,
			'300x480': true
		},
		IFRAME_MARKER_NAME = 'anx-mraid-marker',
		$mraidTag,
		$webView,
		$close,
		videoCount = 0,
		initialSize,
		screenSize;

	options = options || {};
	screenSize = {
		width: options.width || 768,
		height: options.height || 1024
	};

	function buildCloseButton(){
		var $close =  $('<div />')
			.attr('class', 'anx-mraid-close')
			.append('<span>X</span>')
			.hide();

		return $close;
	}

	function canAccessParent(){
		if (!inIframe) return false;

		try {
			window.parent.location.toString();
			return true;
		}
		catch(e){
			return false;
		}
	}

	function getCurrentUrlWithIframeParameter(){
		var myUrl = url.parse(window.location.toString(), true);
		myUrl.query[IFRAME_MARKER_NAME] = 1;
		delete myUrl.search; // make sure the query object is used during format call.

		return url.format(myUrl);
	}

	function findWebView(){
		var $el;
		$el = $mraidTag.parent();
		if ($el.length && $el.is('head')){
			$el = $('body');
		}

		if (!inIframe && $el.is('body')){
			// if we are the only thing on page then hide everything and re-request the 
			// creative from within an iframe so that we have a container that we can size.
			$el.children().hide();

			console.log('***restarting in iframe***');

			var $iframe = $('<iframe />')
				.css('border', 'none')
				.css('width', '100%')
				.css('height', '100%')
				.attr('src', getCurrentUrlWithIframeParameter()); // this is necessary because some browsers block an iframe to the same url.
	
			$el.append($iframe);
			return null;
		}

		return $el;
	}

	function isStandardSize(size){
		return size && (size.width + 'x' + size.height) in STANDARD_SIZES;
	}

	function getCreativeSize(){
		let size = {
				width: $webView.width(),
				height: $webView.height(),
				from: 'html'
			};

		if (isStandardSize(size)) return size;

		let sizeFromUrl = sniffCreativeSizeFromUrl();

		if (sizeFromUrl && size.width == sizeFromUrl.width && size.height == sizeFromUrl.height){
			sizeFromUrl.from = 'html/url';
		}

		return sizeFromUrl || size;
	}

	function sniffCreativeSizeFromUrl(){
		var urlSizeRegEx = /\b\d{2,4}[x\/]\d{2,4}/i,
			search = window.location.search.replace(/\banx-mraid-screen=\d{2,4}x\d{2,4}\b/ig, ''),
			sizeFromUrl = search.match(urlSizeRegEx),
			dimensions;

		if (sizeFromUrl && sizeFromUrl.length){
			dimensions = sizeFromUrl[0].split(/[^\d]/);
			return { width: +dimensions[0], height: +dimensions[1], from: 'url' };
		}

		let widthMatch = search.match(/\bwidth=(\d{2,4})\b/i);
		if (!widthMatch || widthMatch.length < 2) return null;

		let heightMatch = search.match(/\bheight=(\d{2,4})\b/i);
		if (!heightMatch || heightMatch.length < 2) return null;

		return { width: +widthMatch[1], height: +heightMatch[1], from: 'url' };
	}

	function ensureInitialSizeIsSet(size){
		if (!initialSize){
			initialSize = size || getCreativeSize();
		}

		return initialSize;
	}

	function isInSelfMadeFrame(){
		let query = url.parse(window.location.toString(), true).query;
		return query && query[IFRAME_MARKER_NAME];
	}

	this.hide = function() { $webView.hide(); };
	this.show = function() { $webView.show(); };
	this.showClose = function(){ $close.show(); };
	this.hideClose = function(){ $close.hide(); };

	this.resetSize = function(){
		if (!initialSize) return;

		this.setSize(initialSize.width, initialSize.height);
	};

	this.getInitialSize = function() { return ensureInitialSizeIsSet(); };
	this.getScreenSize = function() { return screenSize; };
	this.getCurrentPosition = function() {
		if (!$webView) return {x: 0, y: 0};

		return {
			x: 0,
			y: 0,
			width: $webView.width(),
			height: $webView.height()
		};
	};

	this.getDefaultPosition = function(){
		var pos = Object.create(this.getInitialSize());
		pos.x = 0;
		pos.y = 0;

		return pos;
	};

	this.showMessage = function(txt){
		var $msg = $('<div class="anx-mraid-msg"></div>');

		$msg.append($('<p></p>')
			.text(txt));

		var $closeBtn = buildCloseButton();

		$closeBtn.click(function(){
			$msg.remove();
			$(this).remove();
		});

		$webView.append($closeBtn);
		$webView.append($msg);
		$msg.slideDown('fast', function (){ $closeBtn.fadeIn('fast'); });
	};

	this.showUrl = function(url){
		var $iframe = $('<iframe class="anx-mraid-url"></iframe>')
			.attr('src', url);
	
		$webView.append($iframe);
	};

	this.showVideo = function(url){
		videoCount += 1;
		url = url || '';

		var beforeVideoSize = this.getCurrentPosition();
		var maxSize = this.getScreenSize();
		var $children = $webView.children();
		$children.hide();

		var videoOptions = {
			autoplay: true,
			controls: false
		};

		var videoId = 'anx-mraid-video-' + videoCount;
		var $video = $('<video class="video-js"></video>')
			.css('max-width', maxSize.width + 'px')
			.css('max-height', maxSize.height + 'px')
			.attr('id', videoId);

		var $source = $('<source></source>')
			.attr('type', 'video/'+ url.match(/\.(\w*)($|\?)/)[1])
			.attr('src', url);

		$video.append($source);
		$webView.append($video);

		var $closeBtn = buildCloseButton();
		$closeBtn.addClass('anx-mraid-video-close');
		$closeBtn.show();

		$closeBtn.click(function(){
			$('#'+videoId).remove();
			$closeBtn.remove();
			$children.show();

			self.setSize(beforeVideoSize.width, beforeVideoSize.height);
		});

		videoJs(videoId, videoOptions, function(){
			this.on('loadedmetadata', function(){
				self.setSize(this.tech.width(), this.tech.height());

				$(this.tag)
					.parent()
					.append($closeBtn);
			});
		});
	};
	
	this.setSize = function(width, height){
		ensureInitialSizeIsSet();

		console.log('setting size to ' + width + 'x' + height);

		width = width.toString().match(/^(\d+)/)[1] * 1;
		height = height.toString().match(/^(\d+)/)[1] * 1;

		width = Math.min(width, screenSize.width);
		height = Math.min(height, screenSize.height);
	
		if (inIframe){
			if (canAccessParent()){
				$(getFrameElement(window))
					.css('width', width + 'px')
					.css('height', height + 'px');
			} else {
				// the browser extensions will be listening for this message

				window.parent.postMessage({
					name:'mraid-resize',
					src: window.location.toString(),
					width: width, 
					height: height
				}, '*');
			}
		} else {
			$webView
				.css('width', width + 'px')
				.css('height', height + 'px');
		}
	};

	this.triggerReady = function(){
		$mraidTag = $('script[src*="mraid.js"]');
		if (!$mraidTag || !$mraidTag.length){
			// no mraid tag, bail!
			return;
		}

		$webView = findWebView();
		if (!$webView) return false;

		console.log('screen size ' + screenSize.width + 'x' + screenSize.height);

		$('head').prepend($('<style></style>').html(css));
		$webView.addClass('anx-mraid-webview');
		
		$close = buildCloseButton();

		$close.click(function(){
			$webView.find('.anx-mraid-url').remove();
			self.emit('close-click');
			self.hideClose();
		});

		$webView.append($close);

		let size = getCreativeSize();
		if (isInSelfMadeFrame()){
			console.log('initializing size: ' + size.width + 'x' + size.height + ' (' + size.from + ')');
			ensureInitialSizeIsSet(size);
			this.setSize(size.width, size.height);
		} else if (size) {
			console.log('ignoring initial size: ' + size.width + 'x' + size.height + ' (' + size.from + ')');
		}

	};
};

util.inherits(WebView, EventEmitter);
module.exports = WebView;
