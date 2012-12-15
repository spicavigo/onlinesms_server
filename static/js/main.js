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
      'scope': 'https://www.google.com/m8/feeds'
    };
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
            $('.item').bind('click', function(){
                var name = $(this).find('span').html();
                $('#contact_name2').val(name);
                $('#phone2').val(contacts[name].phone[0])
                $('#sms-modal-label').html("Send SMS to " + name);
                $('#sms-modal .alert').hide();
                $('#sms-modal').modal();
            });
            $('#page-loader').hide();
        }
    });
}
$(function(){
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
                if(data.status==200){
                    
                } else {
                    $('#errormsg').html("Invalid Contact Name or Phone Number").show();
                }           
            });
            return false;
        }
        $('#errormsg').html("Invalid Contact Name or Phone Number").show();
        return false;
    });
    $("#sms-form-modal").submit(function(e){
        e.preventDefault();
        var data = $(this).serialize();
        $.post('/', data, function(data){
            if(JSON.parse(data).status==200){
                $('#sms-modal').modal('hide');
            } else {
                $('#sms-modal .alert').show();
            }           
        });
        return false;
    })
})
