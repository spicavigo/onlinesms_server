var token;
var page=1;
var total=-1;
var contacts={};
var source = [];
var params;

function prettyDate(time){
    d = new Date();
    var date = new Date((time || "").replace(/-/g,"/").replace(/[TZ]/g," ")),
        diff = ((d.getTime() + (d.getTimezoneOffset()*60000) - date.getTime()) / 1000),
        day_diff = Math.floor(diff / 86400);
     if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
        return;

    return day_diff == 0 && (
            diff < 60 && "just now" ||
            diff < 120 && "1 min ago" ||
            diff < 3600 && Math.floor( diff / 60 ) + " mins ago" ||
            diff < 7200 && "1 hour ago" ||
            diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
        day_diff == 1 && "Yesterday" ||
        day_diff < 7 && day_diff + " days ago" ||
        day_diff < 31 && Math.ceil( day_diff / 7 ) + " week ago";
}

// If jQuery is included in the page, adds a jQuery plugin to handle it as well
if ( typeof jQuery != "undefined" )
    jQuery.fn.prettyDate = function(){
        return this.each(function(){
            var $this = jQuery(this),  
                date = prettyDate($this.text());
            if ( date )
                $this.text( date );
        });
    };

function switch_tab(){
    if($('.ribbon a').html()=="Send to Contact"){
        _gaq.push(['_trackPageview', '/send_to_contact']);
        send_to_contact();
    } else {
        _gaq.push(['_trackPageview', '/send_to_number']);
        send_to_number();
    }
        
}
function send_to_contact(){
    $('.send-to-contact').show();
    $('.send-to-number').hide();
    $('.ribbon a').html("Send to Phone #")
}
function send_to_number(){
    $('.send-to-number').show();
    $('.send-to-contact').hide();
    $('.ribbon a').html("Send to Contact")
}
function load() {
    gapi.client.setApiKey('AIzaSyAUuoxYS81W9KvpXJCZX2NjURVMoMCswII');
    gapi.client.load('contacts', 'v3', auth);
}
function auth() {
    var config = {
      'client_id': '762117796319.apps.googleusercontent.com',
      'scope': 'https://www.google.com/m8/feeds'
    };
    gapi.auth.init(function(){
        gapi.auth.authorize(config, function() {
            token = gapi.auth.getToken();
          
            if(! token){
                $('#page-loader').hide();
                $('#errormsg').html("Unable to Fetch Contacts from Google").show();
            } else{
                params = $.param(token);
                token.alt='json';
                get_contacts();
            }      
        });
    });
    
}
function get_contacts(){
    $.ajax({
        url: 'https://www.google.com/m8/feeds/contacts/default/thin',
        dataType: 'jsonp',
        data: token,
        success: function(data) {
            if (total==-1){
                total = parseInt(data.feed['openSearch$totalResults']['$t']);
                token['max-results']=total;
                get_contacts();
                return;
            }
            $.each(data.feed.entry, function(k,value){
                var name = value.title['$t'];
                contacts[name]={
                    'phone':[],
                    'photo':null
                };
                source.push(name);
                if(value['gd$phoneNumber']){
                    $.each(value['gd$phoneNumber'], function(k,val){
                        contacts[name].phone.push(val['$t']);
                    })
                }
                if(value['link']){
                    $.each(value['link'], function(k,val){
                        
                        if(val.type=='image/*' && val.rel.indexOf('rel#photo')>-1)
                            contacts[name].photo = val.href+'?'+params;
                    })
                }
                if(!contacts[name].photo) contacts[name].photo = '/static/img/profile.png'
                if(contacts[name].phone.length == 0){
                    delete contacts[name];
                    source.pop();
                }
            });
            _gaq.push(['_trackEvent', 'google_contact', 'fetch', 'numbers', source.length]);
            $('#phone').typeahead({
                source: source
            });
            var count = 0;
            source = source.sort(function(strA, strB){return strA.toLowerCase().localeCompare(strB.toLowerCase());})
            for(var i=0; i<source.length; i++){
                k = source[i];
                if(contacts[k]==undefined)continue;
                $('.iso-container').append('<li class="item" id="_'+i+'"><img src="'+contacts[k].photo+'" class="img-polaroid" width="96" height="96"><span class="name img-caption">'+k+'</span></img></li>');
            }
            init_isotope();
            $("body").niceScroll({cursorcolor:'#999'});
            $('.item').bind('click', function(){
                _gaq.push(['_trackEvent', 'sidebar', 'show']);
                $('#sms-history').show('slide', {direction: 'right'}, 300, function(){
                    $(histScroll.cursor[0]).parent().css('left', 'auto').css('right',0);
                    $('#sms-history textarea').focus();
                    histScroll.scrollTop(histScroll.getContentSize().h);
                });
                var name = $(this).find('span').html();
                $('#sms-history .contact-title').html(name);
                $('#sms-history #contact_name2').val(name);
                var html='';
                for(var i=0; i<contacts[name].phone.length; i++){
                    html+='<option value="'+contacts[name].phone[i]+'">'+contacts[name].phone[i]+'</option>';
                }
                $('#sms-history #phone2').html(html);
                calc_height();
                fetch_history(name);
            });
            $('#page-loader').hide();
        }
    });
}
function fetch_history(contact_name){
    _gaq.push(['_trackPageview', '/history']);
    $('#sms-history .msgs').html('');
    $.ajax({
        url:'/history/?contact_name='+contact_name,
        success:function(data){
            var html = '';
            _gaq.push(['_trackEvent', 'history', 'fetch', 'count', data.hist.length]);
            for(var i = data.hist.length-1; i>=0; i--){
                var pos;
                var status;
                var h = data.hist[i];
                if (h.sent && h.byme)
                    status='sent';
                else if (! h.byme)
                    status='recv';
                else
                    status='pending';
                var date = prettyDate(h.created);
                html = html + '<div class="sms-item '+status+'" id="msg-' + h.id + '"><div>'+h.msg+'</div><div class="msg-date">'+date+'</div></div>';
                html = html + '<div class="clear"></div>';
            }
            $('#sms-history .msgs').html(html);
            histScroll.scrollTop(histScroll.getContentSize().h);
        }
    })
}
function onDelivery(msg){
    var id = msg.id;
    console.log(id);
    if ($('#msg-'+id).length){
        $('#msg-'+id).removeClass('pending').addClass('sent');
    }
}
function onNewSMS(msg){
    if($('#sms-history:visible').length && ($('#sms-history .contact-title').html() == msg.contact_name)){
        var status;
        if (msg.sent && msg.byme)
            status='sent';
        else if (! msg.byme)
            status='recv';
        else
            status='pending';
        var date = prettyDate(msg.created);
        var html = '<div class="sms-item '+status+'" id="msg-' + msg.id + '"><div>'+msg.msg+'</div><div class="msg-date">'+date+'</div></div>';
        html = html + '<div class="clear"></div>';
        $('#sms-history .msgs').append(html);
        histScroll.scrollTop(histScroll.getContentSize().h);
    } else {
        $('#sms-notification').html("New message from " + msg.contact_name);
        $('#sms-notification').show();
        setTimeout(function(){$('#sms-notification').hide()}, 5000);
    }
}
function calc_height(){
    var h = $('.contact-title').height()+10;
    if($('#sms-history .alert:visible').length)h=h+$('#sms-history .alert').height();
    h=h+$('#sms-history textarea').height()+20;
    h=h+$('#sms-history select').height()+14;
    h=window.innerHeight-h;
    $('#sms-history .msgs').css('min-height', h).css('max-height',h);
    return h;
}
$(function(){
    histScroll = $("#sms-history .msgs").niceScroll({cursorcolor:'#999'});
    
    $('#sms-history .close').bind('click', function(){
        $('#sms-history').hide('slide', {direction: 'right'}, 500);
        _gaq.push(['_trackEvent', 'sidebar', 'close']);
    });
    $('.view-history-action').bind('click', function(){
        $('.modal-form-div').hide();
        $('.history').show();
        $('.history-loader').show();
        fetch_history($('#sms-modal-label').html());
        $(this).hide();        
        $('#modal-submit').hide();
        $('.send-sms-action').show();
    });
    $('.send-sms-action').bind('click', function(){
        $('.history').hide();
        $('.history-loader').hide();
        $('.historymsg').hide();
        $('.history table').hide();
        $('.send-sms-action').hide();
        $('.view-history-action').show();
        $('#modal-submit').show();
        $('.modal-form-div').show();
    })
    $('.dt').prettyDate();
    $("#sms-form").submit(function(e){
        e.preventDefault();
        var val = $("#phone").val();
        $("#contact_name").val(val);
        if(source.indexOf(val)>-1) val = contacts[val][0];
        if(val.length>0){
            $("#phone").val(val);
            _gaq.push(['_trackEvent', 'sendsms', 'bynumber', 'sending']);
            var data = $(this).serialize();
            $.post('/', data, function(data){
                _gaq.push(['_trackEvent', 'sendsms', 'bynumber', 'sent', JSON.parse(data).status]);
                if(JSON.parse(data).status==200){                    
                    $('#successmsg').html("Message Relayed").show();
                    setTimeout(function(){$('#successmsg').hide()}, 5000);
                } else {
                    $('#errormsg').html("Invalid Contact Name or Phone Number or Message").show();
                    setTimeout(function(){$('#errormsg').hide()}, 5000);
                }           
            });
            return false;
        }
        $('#errormsg').html("Invalid Contact Name or Phone Number").show();
        _gaq.push(['_trackEvent', 'sendsms', 'bynumber', 'fail_no_ajax']);
        setTimeout(function(){$('#errormsg').hide()}, 5000);
        return false;
    });
    $('#sms-history textarea').autosize({append: "\n", callback:calc_height});
    $('#sms-history textarea').bind('keypress', function(e) {
        var code = (e.keyCode ? e.keyCode : e.which);
        if(code != 13) return;
        e.preventDefault();
        if($(this).val()=='')return;
        var data = $('#sms-history form').serialize();
        $(this).val('');

        _gaq.push(['_trackEvent', 'sendsms', 'bycontact', 'sending']);
        $.post('/', data, function(data){
            var data = JSON.parse(data);
            _gaq.push(['_trackEvent', 'sendsms', 'bycontact', 'sent', data.status]);
            if(data.status==200){                
                var html = '<div class="sms-item pending" id="msg-'+ data.msg.id + '"><div>'+data.msg.msg+'</div><div class="msg-date">'+prettyDate(data.msg.created)+'</div></div>';
                html = html + '<div class="clear"></div>';
                $('#sms-history .msgs').append(html);
                calc_height();
                histScroll.scrollTop(histScroll.getContentSize().h);
            } else if(data.status==100){
                $('#sms-history .alert').html('Your phone is not yet registered. Install <a target="_blank" href="https://play.google.com/store/apps/details?id=com.fauzism.onlinesms">Online SMS</a> app on your Android Phone from Play Store and register.');
                $('#sms-history .alert').show();
                calc_height();
                histScroll.scrollTop(histScroll.getContentSize().h);
                setTimeout(function(){$('#sms-history .alert').slideUp('slow', calc_height)}, 5000);
            } else {
                $('#sms-history .alert').html('Empty Phone Number or Message');
                $('#sms-history .alert').show();
                calc_height();
                histScroll.scrollTop(histScroll.getContentSize().h);
                setTimeout(function(){$('#sms-history .alert').slideUp('slow', calc_height)}, 5000);
            }      
        });
    });
    window.onresize = calc_height;
})
