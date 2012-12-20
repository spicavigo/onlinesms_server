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

function send_to_contact(){
    $('.send-to-contact').show();
    $('.send-to-number').hide();
    $('.nav li').removeClass('active');
    $('.for_contact').addClass('active');
}
function send_to_number(){
    $('.send-to-number').show();
    $('.send-to-contact').hide();
    $('.nav li').removeClass('active');
    $('.for_number').addClass('active');
}
function load() {
    gapi.client.setApiKey('AIzaSyAUuoxYS81W9KvpXJCZX2NjURVMoMCswII');
    gapi.client.load('contacts', 'v3', auth);
}
function auth() {
    var config = {
      'client_id': '762117796319.apps.googleusercontent.com',
      'scope': 'https://www.google.com/m8/feeds',
      'immediate':true
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
            $("html").niceScroll({cursorcolor:'#999'});
            $('.item').bind('click', function(){
                var name = $(this).find('span').html();
                $('#contact_name2').val(name);
                var html='';
                for(var i=0; i<contacts[name].phone.length; i++){
                    html+='<option value="'+contacts[name].phone[i]+'">'+contacts[name].phone[i]+'</option>';
                }
                $('#phone2').html(html);
                $('#sms-modal-label').html(name);
                $('#sms-modal .alert').hide();
                $('.modal-form-div').show();
                $('.history').hide();
                $('.history-loader').hide();
                $('.historymsg').hide();
                $('.history table').hide();
                $('.send-sms-action').hide();
                $('.view-history-action').show();
                $('.modal-form-div').show();
                $('#modal-submit').show();
                $('#sms-modal').modal();
                
            });
            $('#page-loader').hide();
        }
    });
}
function fetch_history(contact_name){
    $.ajax({
        url:'/history/?contact_name='+contact_name,
        success:function(data){
            var html = '';
            for(var i = 0; i<data.hist.length; i++){
                html+='<tr>'
                var h = data.hist[i];
                if (h.sent && h.byme)
                    html+='<td><span class="label label-success">Sent</span></td>';
                else if (! h.byme)
                    html+='<td><span class="label label-info">Received</span></td>';
                else
                    html+='<td><span class="label">Pending</span></td>';
                html+='<td>'+h.contact_name+'</td>';
                html+='<td>'+h.phone+'</td>';
                html+='<td>'+h.msg+'</td>';
                html+='<td class="dt">'+h.created+'</td>';
            }            
            $('.history tbody').html(html);
            $('.dt').prettyDate();
            $('.history-loader').hide();
            if(! data.hist.length)
                $('.historymsg').show();
            else{
                $('.history table').show();
                $(".modal-body").niceScroll({cursorcolor:'#999'});
            }
        }
    })
}
$(function(){
    
    //$('#sms-modal').on('hidden', function () {
    //    $("html").niceScroll({cursorcolor:'#999'});
    //});
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
            var data = $(this).serialize();
            $.post('/', data, function(data){
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
        setTimeout(function(){$('#errormsg').hide()}, 5000);
        return false;
    });
    $("#sms-form-modal").submit(function(e){
        e.preventDefault();
        var data = $(this).serialize();
        $.post('/', data, function(data){
            if(JSON.parse(data).status==200){
                $('#sms-modal').modal('hide');
            } else if(JSON.parse(data).status==100){
                $('#sms-modal .alert').html('Your phone is not yet registered. Install <a target="_blank" href="https://play.google.com/store/apps/details?id=com.fauzism.onlinesms">Online SMS</a> app on your Android Phone from Play Store and register.');
                $('#sms-modal .alert').show();
                setTimeout(function(){$('#sms-modal .alert').hide()}, 5000);
            } else {
                $('#sms-modal .alert').html('Empty Phone Number or Message');
                $('#sms-modal .alert').show();
                setTimeout(function(){$('#sms-modal .alert').hide()}, 5000);
            }      
        });
        return false;
    })
})
