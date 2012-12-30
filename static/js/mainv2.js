var token;
var page=1;
var total=-1;
var contacts={};
var source = [];
var params;
var Chats = [];

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
function submit_sms(e) {
    var code = (e.keyCode ? e.keyCode : e.which);
    if(code != 13) return;
    e.preventDefault();
    if($(this).val()=='')return;
    var parent = $(this).parents('form');
    var data = parent.serialize();
    $(this).val('');

    _gaq.push(['_trackEvent', 'sendsms', 'bycontact', 'sending']);
    $.post('/', data, function(data){
        var data = JSON.parse(data);
        _gaq.push(['_trackEvent', 'sendsms', 'bycontact', 'sent', data.status]);
        if(data.status==200){                
            var html = '<div class="sms-item pending" id="msg-'+ data.msg.id + '"><div>'+data.msg.msg+'</div><div class="msg-date">'+prettyDate(data.msg.created)+'</div></div>';
            html = html + '<div class="clear"></div>';
            parent.find('.msgs').append(html);

        } else if(data.status==100){
            parent.find('.alert').html('Your phone is not yet registered. Install <a target="_blank" href="https://play.google.com/store/apps/details?id=com.fauzism.onlinesms">Online SMS</a> app on your Android Phone from Play Store and register.').show();
            setTimeout(function(){parent.find('.alert').slideUp('slow', calc_height)}, 5000);
        } else {
            parent.find('.alert').html('Empty Phone Number or Message').show();
            setTimeout(function(){parent.find('.alert').slideUp('slow', calc_height)}, 5000);
        }      
    });
}
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
    $('.ribbon a').html("Send to Phone #");
    $('#open-chat-links').show();
    $('.boxes').show();
}
function send_to_number(){
    $('.send-to-number').show();
    $('.send-to-contact').hide();
    $('.ribbon a').html("Send to Contact");
    $('#open-chat-links').hide();
    $('.boxes').hide();
}

function new_chatbox(num){
    if($('#box_'+num).length){
        $('#box_'+num + ' textarea').focus();
        $('#chatlink_' +num+ ' a').trigger('click');
        return;
    }
    var el = $('#orig-sms-history').clone();
    el.attr("id", "box_"+num);
    $('.boxes').append(el);
    el.find('textarea').focus();
    var name = source[num];
    el.find('textarea').autosize({append: "\n"});
    el.find('textarea').bind('keypress', submit_sms);

    el.find('.contact-title').html(name);
    el.find('.contact_name2').val(name);
    var html='';
    for(var i=0; i<contacts[name].length; i++){
        html+='<option value="'+contacts[name][i]+'">'+contacts[name][i]+'</option>';
    }
    el.find('.phone2').html(html);
    el.show();
    el.find('.close').bind('click', function(){
        remove_chatbox(num)
        _gaq.push(['_trackEvent', 'sidebar', 'close']);
    });
    if(Chats.indexOf(name)==-1){
        Chats.push(name);
        $.cookie('open_chats', JSON.stringify(Chats));
    }
    
    fetch_history(el, name);
    $('#open-chat-links').append('<div class="chatlink" id="chatlink_'+num+'"><button type="button" class="close">&times;</button><a href="#box_'+num+'">'+name+'</a></div>');
    $('#chatlink_' +num+ ' .close').bind('click', function(){
        remove_chatbox(num);
    });
    $('#box_'+num + ' textarea').focus();
    $('#chatlink_' +num+ ' a').trigger('click');
}

function remove_chatbox(num){
    var index = Chats.indexOf(source[num]);
    Chats.splice(index,1);
    $.cookie('open_chats', JSON.stringify(Chats));
    $("#box_"+num).remove();
    $("#chatlink_"+num).remove();
}
function get_contacts(){
    $.ajax({
        url: '/fetch_contacts/',
        dataType: 'json',
        success: function(data) {
            for(var k in data){
                source.push(k);
            }
            contacts = data;
            _gaq.push(['_trackEvent', 'fetch_contact', 'fetch', 'numbers', source.length]);
            $('#phone').typeahead({
                source: source
            });
            var count = 0;
            source = source.sort(function(strA, strB){
                return strA.toLowerCase().localeCompare(strB.toLowerCase());
            });
            for(var i=0; i<source.length; i++){
                k = source[i];
                $('.contactlist').append('<div class="item" id="item_'+i+'">'+k+'</div>');
            }
            $('.item').bind('click', function(){
                _gaq.push(['_trackEvent', 'sidebar', 'show']);
                new_chatbox($(this).attr('id').split('_')[1]);
            });
            $('#page-loader').hide();
            Chats = JSON.parse($.cookie('open_chats'));
            if(Chats==null)Chats=[];
            for (var i=0; i<Chats.length; i++){
                var index = source.indexOf(Chats[i]);
                if(index==-1)continue;
                new_chatbox(index);
            }
        }
    });
}
function fetch_history(el, contact_name){
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
            el.find('.msgs').html(html);
        }
    })
}
function onDelivery(msg){
    var id = msg.id;
    if ($('#msg-'+id).length){
        $('#msg-'+id).removeClass('pending').addClass('sent');
    }
}
function onNewSMS(msg){
    var index = source.indexOf(msg.contact_name);
    if(index == -1){
        console.log("Contact not found");
        console.log(msg);
        return;
    }
    var el = $('#box_'+index);
    if(el.length){
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
        el.find('.msgs').append(html);
        el.find('.msg-container').scrollTop(el.find('.msg-container').height())
    } else {
        $('#sms-notification').html("New message from " + msg.contact_name);
        $('#sms-notification').show();
        setTimeout(function(){$('#sms-notification').hide()}, 5000);
    }
}
function calc_height(){

}
$(function(){
    
    
    
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
    
    get_contacts();
    $('#search').bind('keyup', function(e){
        var val = $(this).val().toLowerCase();
        if(val.length==0){
            $('.item').show();
            return;
        }
        for (var i=0; i<source.length; i++){
            if(source[i].toLowerCase().indexOf(val)!=0)$('#item_'+i).hide();
            else $('#item_'+i).show();
        }
    });
    $('.boxes').width(window.innerWidth-200);
    $('a[href^="#"]').live('click',function (e) {
	    e.preventDefault();
	 
	    var target = this.hash,
	    $target = $(target);
	 
	    $('html, body').stop().animate({
	        'scrollTop': $target.offset().top-10
	    }, 900, 'swing', function () {return false;
	    });
	    return false;
	});
	
})
